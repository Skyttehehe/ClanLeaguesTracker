import { Queue } from "bullmq";

import { config } from "../config";
import { getRedisConnection } from "../lib/redis";

type ClanSyncJobData = {
  id: string;
  source: string;
  timestamp: string | null;
};

let clanSyncQueue: Queue<ClanSyncJobData> | null = null;

const getClanSyncQueue = (): Queue<ClanSyncJobData> => {
  if (!clanSyncQueue) {
    clanSyncQueue = new Queue<ClanSyncJobData>(config.queueName, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    });
  }

  return clanSyncQueue;
};

export const enqueueClanSync = async (payload: ClanSyncJobData): Promise<void> => {
  await getClanSyncQueue().add("sync-clan-data", payload);
};
