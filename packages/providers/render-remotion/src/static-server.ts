import { createReadStream, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".json": "application/json",
};

export interface StaticServer {
  baseUrl: string;
  close(): Promise<void>;
}

/**
 * Minimal range-capable static file server rooted at `root`, bound to loopback.
 * Chromium inside Remotion needs http(s) URLs; file:// is blocked.
 */
export async function startStaticServer(root: string): Promise<StaticServer> {
  const absRoot = path.resolve(root);
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const file = path.resolve(absRoot, rel);
      if (!file.startsWith(absRoot + path.sep) && file !== absRoot) {
        res.writeHead(403).end();
        return;
      }
      const st = statSync(file);
      if (!st.isFile()) {
        res.writeHead(404).end();
        return;
      }
      const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m?.[1] ? Number(m[1]) : 0;
        const end = m?.[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${st.size}`,
          "Accept-Ranges": "bytes",
          "Access-Control-Allow-Origin": "*",
        });
        createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": st.size,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      });
      if (req.method === "HEAD") res.end();
      else createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
