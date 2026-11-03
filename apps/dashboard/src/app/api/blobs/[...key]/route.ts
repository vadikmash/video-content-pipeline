import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import type { NextRequest } from "next/server";
import { blob } from "@/lib/blob";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".json": "application/json",
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const joined = key.map(decodeURIComponent).join("/");
  let file: string;
  try {
    file = blob.localPath!({ key: joined, contentType: "" });
  } catch {
    return new Response("bad key", { status: 400 });
  }
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(file);
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!st.isFile()) return new Response("not found", { status: 404 });

  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${st.size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: { "Content-Type": type, "Content-Length": String(st.size), "Accept-Ranges": "bytes" },
  });
}
