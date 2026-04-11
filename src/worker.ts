import { Job, Worker } from "bullmq";

import { config } from "./config";
import { getRedisConnection } from "./lib/redis";

const worker = new Worker(
  config.queueName,
  async (job) => {
    console.log("Processing job", {
      id: job.id,
      name: job.name,
      data: job.data,
    });
  },
  { connection: getRedisConnection() },
);

worker.on("completed", (job: Job) => {
  console.log(`Job completed: ${job.id}`);
});

worker.on("failed", (job: Job | undefined, error: Error) => {
  console.error(`Job failed: ${job?.id}`, error.message);
});
