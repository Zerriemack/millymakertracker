-- CreateEnum
CREATE TYPE "GameWindow" AS ENUM ('EARLY', 'LATE', 'PRIME', 'OTHER');

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "homeIsIndoor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "week" INTEGER,
    "sport" "Sport" NOT NULL,
    "kickoffTimeUtc" TIMESTAMP(3) NOT NULL,
    "window" "GameWindow" NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeStartingQbPlayerId" TEXT,
    "awayStartingQbPlayerId" TEXT,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerWeekForm" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerWeekForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_seasonId_idx" ON "Game"("seasonId");

-- CreateIndex
CREATE INDEX "Game_seasonId_week_idx" ON "Game"("seasonId", "week");

-- CreateIndex
CREATE INDEX "Game_homeTeamId_idx" ON "Game"("homeTeamId");

-- CreateIndex
CREATE INDEX "Game_awayTeamId_idx" ON "Game"("awayTeamId");

-- CreateIndex
CREATE INDEX "Game_kickoffTimeUtc_idx" ON "Game"("kickoffTimeUtc");

-- CreateIndex
CREATE INDEX "Game_window_idx" ON "Game"("window");

-- CreateIndex
CREATE UNIQUE INDEX "Game_seasonId_homeTeamId_awayTeamId_kickoffTimeUtc_key" ON "Game"("seasonId", "homeTeamId", "awayTeamId", "kickoffTimeUtc");

-- CreateIndex
CREATE INDEX "PlayerWeekForm_seasonId_week_idx" ON "PlayerWeekForm"("seasonId", "week");

-- CreateIndex
CREATE INDEX "PlayerWeekForm_playerId_idx" ON "PlayerWeekForm"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerWeekForm_seasonId_week_playerId_key" ON "PlayerWeekForm"("seasonId", "week", "playerId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeStartingQbPlayerId_fkey" FOREIGN KEY ("homeStartingQbPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayStartingQbPlayerId_fkey" FOREIGN KEY ("awayStartingQbPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerWeekForm" ADD CONSTRAINT "PlayerWeekForm_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerWeekForm" ADD CONSTRAINT "PlayerWeekForm_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupItem" ADD CONSTRAINT "LineupItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
