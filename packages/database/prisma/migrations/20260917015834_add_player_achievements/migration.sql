-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "id" VARCHAR(26) NOT NULL,
    "playerId" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerAchievement_playerId_idx" ON "PlayerAchievement"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAchievement_playerId_serverId_key_key" ON "PlayerAchievement"("playerId", "serverId", "key");

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
