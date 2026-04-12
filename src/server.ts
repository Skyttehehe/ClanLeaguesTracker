import { app } from "./app";
import { config } from "./config";

app.listen(config.port, "0.0.0.0", () => {
  console.log(`API running on port ${config.port}`);
  console.log(`FRONTEND_URL: ${config.frontendUrl}`);
  console.log(`CORS_ORIGIN: ${config.corsOrigin || "(not set)"}`);
});
