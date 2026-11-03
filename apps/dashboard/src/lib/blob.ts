import { createLocalBlobStore } from "@vcp/provider-blob-local";

/** The dashboard only needs read access to serve /api/blobs and build preview URLs. */
export const blob = createLocalBlobStore();

export function blobUrl(key: string): string {
  return `/api/blobs/${key}`;
}
