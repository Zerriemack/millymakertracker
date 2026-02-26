-- CreateEnum
CREATE TYPE "QbRoleArchetype" AS ENUM ('ROOKIE', 'BACKUP', 'BRIDGE', 'JOURNEYMAN', 'FRANCHISE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "QbStyleArchetype" AS ENUM ('GUNSLINGER', 'GAME_MANAGER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "LineupItem" ADD COLUMN     "qbFacedPlayerId" TEXT,
ADD COLUMN     "qbFacedSeasonId" TEXT,
ADD COLUMN     "qbFacedText" TEXT;

-- CreateTable
CREATE TABLE "QbSeason" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sport" "Sport" NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roleArchetype" "QbRoleArchetype" NOT NULL DEFAULT 'UNKNOWN',
    "styleArchetype" "QbStyleArchetype" NOT NULL DEFAULT 'UNKNOWN',
    "qualityScore" DOUBLE PRECISION,
    "qualityMetric" TEXT,
    "dropbacks" INTEGER,
    "epaPerDropback" DOUBLE PRECISION,

    CONSTRAINT "QbSeason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QbSeason_sport_seasonId_idx" ON "QbSeason"("sport", "seasonId");

-- CreateIndex
CREATE INDEX "QbSeason_playerId_idx" ON "QbSeason"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "QbSeason_sport_seasonId_playerId_key" ON "QbSeason"("sport", "seasonId", "playerId");

-- CreateIndex
CREATE INDEX "LineupItem_qbFacedPlayerId_idx" ON "LineupItem"("qbFacedPlayerId");

-- CreateIndex
CREATE INDEX "LineupItem_qbFacedSeasonId_idx" ON "LineupItem"("qbFacedSeasonId");

-- AddForeignKey
ALTER TABLE "QbSeason" ADD CONSTRAINT "QbSeason_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QbSeason" ADD CONSTRAINT "QbSeason_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupItem" ADD CONSTRAINT "LineupItem_qbFacedPlayerId_fkey" FOREIGN KEY ("qbFacedPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupItem" ADD CONSTRAINT "LineupItem_qbFacedSeasonId_fkey" FOREIGN KEY ("qbFacedSeasonId") REFERENCES "QbSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
