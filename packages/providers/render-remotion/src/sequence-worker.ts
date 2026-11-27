/**
 * Trusted launcher for the disposable sequence worker container. Each job runs
 * in a fresh container with no network, no mounts from the host, no
 * credentials or environment from this process, a read-only image, a bounded
 * tmpfs for scratch and output, dropped capabilities and CPU/memory/PID limits.
 * Inputs go in on stdin; framed outputs come back on stdout with a byte cap.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EXIT, WORKER_IMAGE, type Diagnostic, type WorkerJob } from "@vcp/animation-worker/job";
import { FrameDecoder, type DecodedFile } from "@vcp/animation-worker/protocol";

export type SequenceWorkerErrorKind = "unavailable" | "job" | "preflight" | "typecheck" | "bundle" | "render" | "output" | "timeout" | "limits" | "canceled";

export class SequenceWorkerError extends Error {
  constructor(readonly kind: SequenceWorkerErrorKind, message: string, readonly diagnostics: Diagnostic[] = []) {
    super(message);
    this.name = "SequenceWorkerError";
  }
  /** Source problems the author can repair; everything else is infrastructure. */
  get repairable(): boolean {
    return this.kind === "preflight" || this.kind === "typecheck" || this.kind === "render";
  }
}

export interface SequenceWorkerLimits {
  memory: string;
  cpus: number;
  pids: number;
  /** Scratch tmpfs for the job directory (sources, bundle) and output, in MiB. */
  scratchMb: number;
  outputMb: number;
  shmMb: number;
  timeoutMs: number;
  maxOutputBytes: number;
}

export const DEFAULT_LIMITS: SequenceWorkerLimits = {
  memory: "3g",
  cpus: 2,
  pids: 512,
  scratchMb: 512,
  outputMb: 1536,
  shmMb: 512,
  timeoutMs: 10 * 60_000,
  maxOutputBytes: 1536 * 1024 * 1024,
};

export interface SequenceWorkerResult {
  files: DecodedFile[];
  diagnostics: Diagnostic[];
  image: string;
  imageId: string;
  elapsedMs: number;
}

export interface SequenceWorker {
  readonly image: string;
  run(job: WorkerJob, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<SequenceWorkerResult>;
}

/** The exact `docker run` arguments. Kept separate so the isolation flags are tested. */
export function dockerRunArgs(name: string, image: string, limits: SequenceWorkerLimits): string[] {
  return [
    "run", "--rm", "-i",
    "--name", name,
    "--network", "none",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", "10001:10001",
    "--ipc", "private",
    "--pids-limit", String(limits.pids),
    "--memory", limits.memory,
    "--memory-swap", limits.memory,
    "--cpus", String(limits.cpus),
    "--shm-size", `${limits.shmMb}m`,
    "--ulimit", "nofile=4096:4096",
    "--ulimit", "core=0",
    "--tmpfs", `/tmp:rw,noexec,nosuid,nodev,size=${limits.outputMb}m,uid=10001,gid=10001,mode=0700`,
    "--tmpfs", `/app/job:rw,noexec,nosuid,nodev,size=${limits.scratchMb}m,uid=10001,gid=10001,mode=0700`,
    "--log-driver", "none",
    "--label", "vcp.role=sequence-worker",
    // No -e, --env-file or -v: the worker sees no host files, environment or credentials.
    image,
  ];
}

const KINDS: Record<number, SequenceWorkerErrorKind> = {
  [EXIT.job]: "job",
  [EXIT.preflight]: "preflight",
  [EXIT.typecheck]: "typecheck",
  [EXIT.bundle]: "bundle",
  [EXIT.render]: "render",
  [EXIT.output]: "output",
};

export function createDockerSequenceWorker(options: { image?: string; docker?: string; limits?: Partial<SequenceWorkerLimits> } = {}): SequenceWorker {
  const image = options.image ?? process.env.ANIMATION_WORKER_IMAGE ?? WORKER_IMAGE;
  const docker = options.docker ?? "docker";
  const fromEnv = Number(process.env.ANIMATION_WORKER_TIMEOUT_MS);
  const limits = { ...DEFAULT_LIMITS, ...(fromEnv > 0 ? { timeoutMs: fromEnv } : {}), ...options.limits };

  async function imageId(): Promise<string> {
    const inspect = await new Promise<{ status: number | null; stdout: string; stderr: string; error?: Error }>((resolve) => {
      const child = spawn(docker, ["image", "inspect", "--format", "{{.Id}}", image], { env: dockerEnv() });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (text: string) => (stdout += text));
      child.stderr.setEncoding("utf8").on("data", (text: string) => (stderr += text));
      child.on("error", (error) => resolve({ status: null, stdout, stderr, error }));
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
    if (inspect.error) throw new SequenceWorkerError("unavailable", `Docker is not available (${inspect.error.message}). Start Docker to render authored animation.`);
    if (inspect.status !== 0) {
      const daemon = /daemon|connect/i.test(inspect.stderr);
      throw new SequenceWorkerError("unavailable", daemon
        ? "The Docker daemon is not running. Start Docker to render authored animation."
        : `The sequence worker image ${image} is missing. Build it with \`pnpm animation-worker:build\`.`);
    }
    return inspect.stdout.trim();
  }

  return {
    image,
    async run(job, runOptions = {}) {
      const started = Date.now();
      const id = await imageId();
      const name = `vcp-seq-${randomUUID()}`;
      const child = spawn(docker, dockerRunArgs(name, image, limits), { stdio: ["pipe", "pipe", "pipe"], env: dockerEnv() });
      const decoder = new FrameDecoder({
        maxBytes: limits.maxOutputBytes,
        maxFiles: 64,
        allowName: (file) => /^(visual\.(mp4|mov)|still-\d{3}-f\d+\.png)$/.test(file),
      });
      const diagnostics: Diagnostic[] = [];
      let stderrTail = "";
      let failure: SequenceWorkerError | undefined;
      let settle: ((code: number | null) => void) | undefined;
      // Never block the event loop on the docker CLI: it can take minutes on a loaded machine.
      const kill = (error: SequenceWorkerError) => {
        failure ??= error;
        spawn(docker, ["kill", name], { env: dockerEnv(), stdio: "ignore" }).on("error", () => undefined);
        child.kill("SIGKILL");
        settle?.(null);
      };
      const timeoutMs = runOptions.timeoutMs ?? limits.timeoutMs;
      const timer = setTimeout(() => kill(new SequenceWorkerError("timeout", `The sequence worker exceeded ${Math.round(timeoutMs / 1000)}s and was stopped`)), timeoutMs);
      const onAbort = () => kill(new SequenceWorkerError("canceled", "The sequence render was canceled"));
      runOptions.signal?.addEventListener("abort", onAbort, { once: true });
      if (runOptions.signal?.aborted) onAbort();

      child.stdout.on("data", (chunk: Buffer) => {
        try {
          decoder.push(chunk);
        } catch (error) {
          kill(new SequenceWorkerError("limits", (error as Error).message));
        }
      });
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (text: string) => {
        stderrTail = (stderrTail + text).slice(-8000);
        for (const line of text.split("\n")) {
          if (!line.startsWith("VCPDIAG ") || diagnostics.length >= 40) continue;
          try {
            diagnostics.push(JSON.parse(line.slice(8)) as Diagnostic);
          } catch {
            // Partial line; the tail keeps the context for the error message.
          }
        }
      });
      child.stdin.on("error", () => undefined);
      child.stdin.end(JSON.stringify(job));

      const code = await new Promise<number | null>((resolve) => {
        settle = resolve;
        child.on("error", (error) => {
          failure ??= new SequenceWorkerError("unavailable", `Could not start the sequence worker: ${error.message}`);
          resolve(null);
        });
        child.on("close", (exit) => resolve(exit));
      });
      clearTimeout(timer);
      runOptions.signal?.removeEventListener("abort", onAbort);

      if (failure) {
        if (failure.kind === "timeout" || failure.kind === "canceled" || failure.kind === "limits") await removeContainer(docker, name);
        throw failure;
      }
      if (code === 137) throw new SequenceWorkerError("limits", `The sequence worker was killed (out of memory or a resource limit; memory ${limits.memory})`, diagnostics);
      if (code !== 0) {
        const kind = (code !== null && KINDS[code]) || "render";
        const detail = diagnostics.length
          ? diagnostics.slice(0, 5).map((d) => (d.line ? `line ${d.line}: ${d.message}` : d.message)).join("; ")
          : scrub(stderrTail).split("\n").filter(Boolean).slice(-3).join(" ");
        throw new SequenceWorkerError(kind, `Sequence ${kind} failed: ${detail}`.slice(0, 1200), diagnostics);
      }
      if (!decoder.ended) throw new SequenceWorkerError("output", "The sequence worker ended without complete output", diagnostics);
      return { files: decoder.files, diagnostics, image, imageId: id, elapsedMs: Date.now() - started };
    },
  };
}

/** Force-remove a stopped or stopping job container; bounded so cleanup cannot hang a stage. */
function removeContainer(docker: string, name: string): Promise<void> {
  return new Promise((resolve) => {
    const rm = spawn(docker, ["rm", "-f", name], { env: dockerEnv(), stdio: "ignore" });
    const timer = setTimeout(() => { rm.kill("SIGKILL"); resolve(); }, 120_000);
    rm.on("error", () => { clearTimeout(timer); resolve(); });
    rm.on("close", () => { clearTimeout(timer); resolve(); });
  });
}

/** Only what the docker CLI needs to reach the daemon; never API keys or database URLs. */
function dockerEnv(): NodeJS.ProcessEnv {
  const keep = ["PATH", "HOME", "DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "DOCKER_CERT_PATH", "DOCKER_TLS_VERIFY"];
  return Object.fromEntries(keep.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
}

function scrub(text: string): string {
  return text.replace(/\/(Users|home|private|var)\/[^\s"']+/g, "<path>").replace(/[A-Za-z0-9_-]{32,}/g, "<redacted>");
}
