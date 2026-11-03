import { EventSchemas, type EventData, type EventName } from "@vcp/core";
import { Inngest } from "inngest";

const isDev = process.env.INNGEST_DEV !== "0" && process.env.NODE_ENV !== "production";

/** Send-only client. The pipeline app owns the functions; the dashboard only emits events. */
export const inngest = new Inngest({
  id: "vcp-dashboard",
  isDev,
  ...(process.env.INNGEST_BASE_URL ? { baseUrl: process.env.INNGEST_BASE_URL } : {}),
});

export async function sendEvent<N extends EventName>(name: N, data: EventData<N>): Promise<void> {
  const parsed = EventSchemas[name].parse(data);
  await inngest.send({ name, data: parsed });
}
