import dotenv from "dotenv";

dotenv.config();

const parsePort = (value: string | undefined): number => {
  const fallbackPort = 3000;
  if (!value) {
    return fallbackPort;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackPort;
  }

  return parsed;
};

export const config = {
  port: parsePort(process.env.PORT),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3001",
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 20,
  womBaseUrl: process.env.WOM_BASE_URL ?? "https://api.wiseoldman.net/v2",
  womApiKey: process.env.WOM_API_KEY ?? "",
  womUserAgent: process.env.WOM_USER_AGENT ?? "ClanLeaguesTracker",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/clan_leagues_tracker?schema=public",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  queueName: process.env.QUEUE_NAME ?? "clan-sync-queue",
};
