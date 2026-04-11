import IORedis from "ioredis";

import { config } from "../config";

let redisConnection: IORedis | null = null;

export const getRedisConnection = (): IORedis => {
  if (!redisConnection) {
    redisConnection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    redisConnection.on("error", (error: Error) => {
      console.error("Redis connection error:", error.message);
    });
  }

  return redisConnection;
};
