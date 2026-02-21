-- AlterTable
ALTER TABLE "LineupItem" ADD COLUMN     "defensiveTdCount" INTEGER,
ADD COLUMN     "gameId" TEXT,
ADD COLUMN     "opponentStartingQbPlayerId" TEXT,
ADD COLUMN     "opponentTeamId" TEXT,
ADD COLUMN     "passInt" INTEGER,
ADD COLUMN     "passTd" INTEGER,
ADD COLUMN     "passYds" INTEGER,
ADD COLUMN     "pointsAllowedBucket" INTEGER,
ADD COLUMN     "rec" INTEGER,
ADD COLUMN     "recRb" INTEGER,
ADD COLUMN     "recTd" INTEGER,
ADD COLUMN     "recTdRb" INTEGER,
ADD COLUMN     "recYds" INTEGER,
ADD COLUMN     "recYdsRb" INTEGER,
ADD COLUMN     "rushAtt" INTEGER,
ADD COLUMN     "rushTd" INTEGER,
ADD COLUMN     "rushTdRb" INTEGER,
ADD COLUMN     "rushYds" INTEGER,
ADD COLUMN     "rushYdsRb" INTEGER,
ADD COLUMN     "sacks" INTEGER,
ADD COLUMN     "takeaways" INTEGER,
ADD COLUMN     "targets" INTEGER,
ADD COLUMN     "targetsRb" INTEGER;

-- CreateIndex
CREATE INDEX "LineupItem_gameId_idx" ON "LineupItem"("gameId");

-- CreateIndex
CREATE INDEX "LineupItem_opponentTeamId_idx" ON "LineupItem"("opponentTeamId");

-- CreateIndex
CREATE INDEX "LineupItem_opponentStartingQbPlayerId_idx" ON "LineupItem"("opponentStartingQbPlayerId");

-- CreateIndex
CREATE INDEX "LineupItem_pointsAllowedBucket_idx" ON "LineupItem"("pointsAllowedBucket");

-- AddForeignKey
ALTER TABLE "LineupItem" ADD CONSTRAINT "LineupItem_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupItem" ADD CONSTRAINT "LineupItem_opponentStartingQbPlayerId_fkey" FOREIGN KEY ("opponentStartingQbPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
