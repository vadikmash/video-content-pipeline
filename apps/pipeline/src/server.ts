import http from "node:http";
import { serve } from "inngest/node";
import { functions } from "./functions";
import { inngest } from "./inngest";

const port = Number(process.env.PIPELINE_PORT ?? 3001);
const servePath = "/api/inngest";

const handler = serve({ client: inngest, functions, servePath });

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, functions: functions.length }));
    return;
  }
  if (req.url?.startsWith(servePath)) {
    handler(req, res);
    return;
  }
  res.writeHead(404).end();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[pipeline] serving ${functions.length} Inngest functions at http://localhost:${port}${servePath}`);
});
