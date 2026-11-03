import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineManifest, type BlobRef, type BlobStore, type ProviderContext } from "@vcp/core";

export const manifest = defineManifest({
  id: "blob-local",
  port: "BlobStore",
  env: ["BLOB_DIR"],
  limits: {},
  attributionRequired: false,
  costModel: { unit: "request", approxUsd: 0 },
  description: "Local disk blob store for development. Never use on a production app server.",
});

export interface LocalBlobOptions {
  /** Directory for blobs; defaults to env BLOB_DIR or .data/blobs. */
  dir?: string;
  /** Base URL that serves /api/blobs/<key>; defaults to env DASHBOARD_URL or http://localhost:3000. */
  baseUrl?: string;
}

export function resolveBlobDir(dir?: string): string {
  const raw = dir ?? process.env.BLOB_DIR ?? ".data/blobs";
  return path.isAbsolute(raw) ? raw : path.resolve(findRepoRoot(), raw);
}

/** Walk up from cwd to the directory containing pnpm-workspace.yaml; fall back to cwd. */
export function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function safeKey(key: string): string {
  const normalised = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalised.split("/").some((seg) => seg === ".." || seg === "")) {
    throw new Error(`invalid blob key: ${key}`);
  }
  return normalised;
}

export function createLocalBlobStore(opts: LocalBlobOptions = {}): BlobStore & { dir: string } {
  const dir = resolveBlobDir(opts.dir);
  const baseUrl = (opts.baseUrl ?? process.env.DASHBOARD_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const fullPath = (key: string) => path.join(dir, safeKey(key));

  return {
    id: manifest.id,
    dir,
    async put(key, bytes, contentType) {
      const p = fullPath(key);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, bytes);
      return { key: safeKey(key), contentType, size: bytes.byteLength } satisfies BlobRef;
    },
    async get(ref) {
      return new Uint8Array(await readFile(fullPath(ref.key)));
    },
    async url(ref) {
      return `${baseUrl}/api/blobs/${ref.key}`;
    },
    localPath(ref) {
      return fullPath(ref.key);
    },
    localRoot() {
      return dir;
    },
  };
}

export function create(ctx: ProviderContext): BlobStore {
  return createLocalBlobStore({
    dir: typeof ctx.options.dir === "string" ? ctx.options.dir : undefined,
    baseUrl: typeof ctx.options.baseUrl === "string" ? ctx.options.baseUrl : undefined,
  });
}
