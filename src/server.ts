console.log("server.ts starting — Node", process.version, "PORT env:", process.env.PORT);

import { app } from "./app";
import { config } from "./config";

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  process.exit(1);
});

process.on("exit", (code) => {
  console.log(`Process exiting with code ${code}`);
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`API running on port ${config.port}`);
  console.log(`FRONTEND_URL: ${config.frontendUrl}`);
  console.log(`CORS_ORIGIN: ${config.corsOrigin || "(not set)"}`);
});