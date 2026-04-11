-- CreateTable
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL,
    "womGroupId" INTEGER,
    "name" TEXT NOT NULL,
    "clanChat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "womPlayerId" INTEGER,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "playerType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionSelection" (
    "id" TEXT NOT NULL,
    "clanName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayClanName" TEXT NOT NULL,
    "displayUsername" TEXT NOT NULL,
    "regions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegionSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Clan_name_key" ON "Clan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Player_womPlayerId_key" ON "Player"("womPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_clanId_playerId_key" ON "Membership"("clanId", "playerId");

-- CreateIndex
CREATE INDEX "RegionSelection_clanName_idx" ON "RegionSelection"("clanName");

-- CreateIndex
CREATE UNIQUE INDEX "RegionSelection_clanName_username_key" ON "RegionSelection"("clanName", "username");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
