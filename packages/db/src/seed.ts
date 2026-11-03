import { DEFAULT_GATE_MODES, GATES, PORT_NAMES } from "@vcp/core";
import { closeDb } from "./client";
import { DEFAULT_PORT_BINDINGS } from "./defaults";
import { listConfigRows, setGateMode, setPortBinding } from "./repo/config";

/**
 * Idempotent: only inserts bindings that are not already configured,
 * so a re-seed never overwrites choices made in the dashboard.
 */
async function main() {
  const existing = await listConfigRows("global");
  const have = new Set(existing.map((r) => `${r.kind}:${r.key}`));

  for (const port of PORT_NAMES) {
    if (have.has(`port:${port}`)) continue;
    const b = DEFAULT_PORT_BINDINGS[port];
    await setPortBinding(port, b.providerId, b.options ?? {});
    console.log(`port ${port} -> ${b.providerId}`);
  }
  for (const gate of GATES) {
    if (have.has(`gate:${gate}`)) continue;
    await setGateMode(gate, DEFAULT_GATE_MODES[gate]);
    console.log(`gate ${gate} -> ${DEFAULT_GATE_MODES[gate]}`);
  }
  console.log("seed complete");
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
