import { EventSchemas, type EventData, type EventName } from "@vcp/core";
import { Inngest } from "inngest";

const inngest = new Inngest({
  id: "vcp-dashboard",
  isDev: process.env.INNGEST_DEV !== "0" && process.env.NODE_ENV !== "production",
  ...(process.env.INNGEST_BASE_URL ? { baseUrl: process.env.INNGEST_BASE_URL } : {}),
});

/** `id` makes the send idempotent: Inngest drops a second event with the same id (24h window). */
export async function sendEvent<N extends EventName>(name: N, data: EventData<N>, opts: { id?: string } = {}): Promise<void> {
  EventSchemas[name].parse(data);
  await inngest.send({ name, data, ...(opts.id ? { id: opts.id } : {}) });
}
