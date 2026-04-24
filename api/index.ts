// Vercel serverless entry point — re-exports the Express app so @vercel/node
// can use it as the HTTP handler for all API routes.
import type { IncomingMessage, ServerResponse } from "http";

let handler: (req: IncomingMessage, res: ServerResponse) => void;

try {
  const mod = require("../src/app");
  handler = mod.app;
} catch (err) {
  handler = (_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Startup failed", detail: String(err) }));
  };
}

export default handler!;
