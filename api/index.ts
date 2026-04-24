// Vercel serverless entry point — re-exports the Express app so @vercel/node
// can use it as the HTTP handler for all API routes.
import { app } from "../src/app";

export default app;
