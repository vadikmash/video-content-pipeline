/**
 * Container entry point. Reads one job as JSON on stdin, runs preflight,
 * typecheck, bundle and render entirely inside the container, and writes the
 * framed output files to stdout. Diagnostics go to stderr as JSON lines.
 * It has no network, no host mounts and no credentials; see the host launcher.
 */
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { COMPOSITION_ID, EXIT, MAX_JOB_BYTES, PROFILES, WorkerJob, type Diagnostic, type ParsedWorkerJob } from "./job";
import { preflight } from "./preflight";
import { MAGIC, encodeHeader } from "./protocol";

const APP = process.env.VCP_WORKER_APP ?? "/app";
const JOB_DIR = path.join(APP, "job");
const OUT_DIR = "/tmp/out";
const MOTION_ENTRY = path.join(APP, "motion/index.tsx");

// Remotion and webpack log to the console; keep stdout for framed output only.
const stdoutWrite = process.stdout.write.bind(process.stdout);
for (const method of ["log", "info", "warn", "debug"] as const) {
  console[method] = (...args: unknown[]) => void process.stderr.write(`${args.map(String).join(" ").slice(0, 500)}\n`);
}

function diag(d: Diagnostic) {
  process.stderr.write(`VCPDIAG ${JSON.stringify({ ...d, message: d.message.slice(0, 600) })}\n`);
}

const started = Date.now();
function progress(stage: Diagnostic["stage"], message: string) {
  process.stderr.write(`VCPPROGRESS ${JSON.stringify({ stage, message, elapsedMs: Date.now() - started })}\n`);
}

function fail(stage: Diagnostic["stage"], code: number, message: string): never {
  diag({ stage, message });
  process.exit(code);
}

async function readJob(): Promise<ParsedWorkerJob> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += (chunk as Buffer).length;
    if (size > MAX_JOB_BYTES) fail("job", EXIT.job, `Job exceeds ${MAX_JOB_BYTES} bytes`);
    chunks.push(chunk as Buffer);
  }
  const parsed = WorkerJob.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if (!parsed.success) fail("job", EXIT.job, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return parsed.data;
}

function typecheck(): Diagnostic[] {
  const program = ts.createProgram([path.join(JOB_DIR, "sequence.tsx"), path.join(JOB_DIR, "check.ts")], {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    types: [],
    skipLibCheck: true,
    esModuleInterop: true,
    isolatedModules: true,
    paths: { "@vcp/motion": [MOTION_ENTRY] },
  });
  return ts.getPreEmitDiagnostics(program)
    .filter((d) => !d.file || d.file.fileName.startsWith(JOB_DIR))
    .slice(0, 20)
    .map((d) => {
      const where = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : undefined;
      const inCheck = d.file?.fileName.endsWith("check.ts");
      return {
        stage: "typecheck" as const,
        message: inCheck
          ? `The default export must accept SequenceProps and return React content: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`
          : ts.flattenDiagnosticMessageText(d.messageText, " "),
        line: inCheck ? undefined : where && where.line + 1,
        column: inCheck ? undefined : where && where.character + 1,
      };
    });
}

async function emit(files: string[]) {
  stdoutWrite(MAGIC);
  for (const name of files) {
    const bytes = await readFile(path.join(OUT_DIR, name));
    stdoutWrite(encodeHeader({ name, size: bytes.length }));
    await new Promise<void>((resolve, reject) => stdoutWrite(bytes, (error) => (error ? reject(error) : resolve())));
  }
  await new Promise<void>((resolve) => stdoutWrite(encodeHeader({ end: true }), () => resolve()));
}

async function main() {
  const job = await readJob();

  const checked = preflight(job.source);
  if (!checked.ok) {
    for (const issue of checked.issues.slice(0, 20)) diag({ stage: "preflight", ...issue });
    process.exit(EXIT.preflight);
  }

  await mkdir(JOB_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(JOB_DIR, "sequence.tsx"), job.source, "utf8");
  await copyFile(path.join(APP, "wrapper/entry.tsx"), path.join(JOB_DIR, "entry.tsx"));
  await copyFile(path.join(APP, "wrapper/check.ts"), path.join(JOB_DIR, "check.ts"));

  progress("preflight", "passed");
  const typeErrors = typecheck();
  if (typeErrors.length) {
    typeErrors.forEach(diag);
    process.exit(EXIT.typecheck);
  }

  progress("typecheck", "passed");
  let serveUrl: string;
  try {
    serveUrl = await bundle({
      entryPoint: path.join(JOB_DIR, "entry.tsx"),
      outDir: path.join(JOB_DIR, "bundle"),
      enableCaching: false,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: { ...(config.resolve?.alias as Record<string, string> | undefined), "@vcp/motion": MOTION_ENTRY },
          modules: [path.join(APP, "node_modules"), "node_modules"],
        },
      }),
    });
  } catch (error) {
    fail("bundle", EXIT.bundle, `Bundling failed: ${(error as Error).message}`);
  }

  progress("bundle", "done");
  const profile = PROFILES[job.profile];
  const inputProps = { sequence: job.sequence };
  const files: string[] = [];
  const chromiumOptions = { gl: "swangle" as const, enableMultiProcessOnLinux: true };
  try {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, chromiumOptions, logLevel: "error" });
    if (job.mode === "video") {
      await renderMedia({
        composition,
        serveUrl,
        inputProps,
        codec: profile.codec,
        ...(profile.codec === "prores" ? { proResProfile: "hq" as const } : { crf: 20, pixelFormat: "yuv420p" as const }),
        scale: profile.scale,
        muted: true,
        enforceAudioTrack: false,
        outputLocation: path.join(OUT_DIR, profile.file),
        concurrency: job.concurrency,
        chromiumOptions,
        logLevel: "error",
        onProgress: ({ renderedFrames, encodedFrames }) => {
          if (renderedFrames % 50 === 0) progress("render", `rendered ${renderedFrames}, encoded ${encodedFrames}`);
        },
      });
      files.push(profile.file);
    } else {
      const frames = job.frames ?? [];
      const browser = await openBrowser("chrome", { chromiumOptions, logLevel: "error" });
      try {
        // One tab renders every requested frame in the given order, so state carried between seeks would show.
        for (const [index, frame] of frames.entries()) {
          if (frame >= composition.durationInFrames) fail("job", EXIT.job, `Frame ${frame} is outside the sequence`);
          const name = `still-${String(index).padStart(3, "0")}-f${frame}.png`;
          await renderStill({ composition, serveUrl, inputProps, frame, output: path.join(OUT_DIR, name), imageFormat: "png", scale: profile.scale, puppeteerInstance: browser, chromiumOptions, logLevel: "error" });
          files.push(name);
        }
      } finally {
        await browser.close({ silent: true });
      }
    }
  } catch (error) {
    fail("render", EXIT.render, `Render failed: ${(error as Error).message.split("\n").slice(0, 6).join(" ")}`);
  }

  for (const name of files) {
    const info = await stat(path.join(OUT_DIR, name));
    if (!info.isFile()) fail("output", EXIT.output, `${name} is not a regular file`);
  }
  progress("output", `emitting ${files.length} file(s)`);
  await emit(files);
  process.exit(EXIT.ok);
}

main().catch((error) => fail("render", EXIT.render, (error as Error).message));
