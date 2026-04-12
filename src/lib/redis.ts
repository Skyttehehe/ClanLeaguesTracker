import IORedis from "ioredis";

import { config } from "../config";

let redisConnection: IORedis | null = null;

export const getRedisConnection = (): IORedis => {
  if (!redisConnection) {
    redisConnection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn(`Redis unavailable after ${times} retries — giving up`);
          return null; // stop retrying
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisConnection.on("error", (error: Error) => {
      console.error("Redis connection error:", error.message);
    });
  }

  return redisConnection;
};
