/**
 * Output framing on the worker's stdout: MAGIC, then for each file a 4-byte
 * big-endian header length, a JSON header {name, size}, and the bytes. A header
 * with `end: true` closes the stream. The host scans for MAGIC so stray log
 * output before it cannot be mistaken for a file.
 */
export const MAGIC = Buffer.from("VCPSEQ1\n");

export interface FileHeader { name: string; size: number }

export function encodeHeader(header: FileHeader | { end: true }): Buffer {
  const json = Buffer.from(JSON.stringify(header));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(json.length);
  return Buffer.concat([length, json]);
}

export interface DecodedFile { name: string; bytes: Buffer }

/** Incremental decoder with byte and name limits; throws on anything unexpected. */
export class FrameDecoder {
  private buffer = Buffer.alloc(0);
  private started = false;
  private current: (FileHeader & { chunks: Buffer[]; received: number }) | undefined;
  private total = 0;
  readonly files: DecodedFile[] = [];
  ended = false;

  constructor(private readonly limits: { maxBytes: number; maxFiles: number; allowName: (name: string) => boolean }) {}

  push(chunk: Buffer): void {
    if (this.ended) {
      if (chunk.length) throw new Error("Worker wrote data after the end of its output");
      return;
    }
    this.total += chunk.length;
    if (this.total > this.limits.maxBytes) throw new Error(`Worker output exceeds ${this.limits.maxBytes} bytes`);
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.started) {
      const at = this.buffer.indexOf(MAGIC);
      if (at < 0) {
        // Keep only a tail long enough to contain a split marker.
        this.buffer = this.buffer.subarray(Math.max(0, this.buffer.length - MAGIC.length));
        return;
      }
      this.buffer = this.buffer.subarray(at + MAGIC.length);
      this.started = true;
    }
    for (;;) {
      if (this.current) {
        const need = this.current.size - this.current.received;
        const take = this.buffer.subarray(0, need);
        this.current.chunks.push(take);
        this.current.received += take.length;
        this.buffer = this.buffer.subarray(take.length);
        if (this.current.received < this.current.size) return;
        this.files.push({ name: this.current.name, bytes: Buffer.concat(this.current.chunks) });
        this.current = undefined;
        continue;
      }
      if (this.buffer.length < 4) return;
      const length = this.buffer.readUInt32BE(0);
      if (length > 4096) throw new Error("Worker output header is too large");
      if (this.buffer.length < 4 + length) return;
      const header = JSON.parse(this.buffer.subarray(4, 4 + length).toString("utf8")) as Partial<FileHeader> & { end?: boolean };
      this.buffer = this.buffer.subarray(4 + length);
      if (header.end) {
        this.ended = true;
        if (this.buffer.length) throw new Error("Worker wrote data after the end of its output");
        return;
      }
      if (typeof header.name !== "string" || !this.limits.allowName(header.name)) throw new Error(`Unexpected worker output ${String(header.name).slice(0, 40)}`);
      if (!Number.isInteger(header.size) || header.size! < 0) throw new Error("Invalid worker output size");
      if (this.files.length >= this.limits.maxFiles) throw new Error("Worker returned too many files");
      if (this.files.some((file) => file.name === header.name)) throw new Error(`Duplicate worker output ${header.name}`);
      this.current = { name: header.name, size: header.size!, chunks: [], received: 0 };
    }
  }
}
