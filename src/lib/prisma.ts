import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | null | undefined;
}

let prismaInstance: PrismaClient | null = null;

try {
  prismaInstance =
    globalThis.prisma ??
    new PrismaClient({
      log: ["error", "warn"],
    });

  if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = prismaInstance;
  }
} catch (error) {
  console.warn("⚠️  Database connection failed. Database features will be disabled.");
  prismaInstance = null;
}

export const prisma = prismaInstance;
