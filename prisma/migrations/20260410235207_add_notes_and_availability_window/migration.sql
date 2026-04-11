-- AlterTable
ALTER TABLE "RegionSelection" ADD COLUMN     "availabilityEndUtc" TIMESTAMP(3),
ADD COLUMN     "availabilitySourceOffsetMinutes" INTEGER,
ADD COLUMN     "availabilityStartUtc" TIMESTAMP(3),
ADD COLUMN     "noteText" TEXT;
