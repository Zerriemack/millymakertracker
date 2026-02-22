-- CreateEnum
CREATE TYPE "CorrelationType" AS ENUM ('STACK', 'BRINGBACK');

-- CreateTable
CREATE TABLE "LineupAnalysis" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "archetypeTags" JSONB,
    "macroStory" TEXT,
    "earlyCount" INTEGER,
    "lateCount" INTEGER,
    "primeCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineupAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupItemAnalysis" (
    "id" TEXT NOT NULL,
    "lineupItemId" TEXT NOT NULL,
    "roleTags" JSONB,
    "microStory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineupItemAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupCorrelation" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "gameId" TEXT,
    "type" "CorrelationType" NOT NULL,
    "qbPlayerId" TEXT NOT NULL,
    "teammatePlayerId" TEXT,
    "opponentPlayerId" TEXT,

    CONSTRAINT "LineupCorrelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineupAnalysis_lineupId_key" ON "LineupAnalysis"("lineupId");

-- CreateIndex
CREATE INDEX "LineupAnalysis_lineupId_idx" ON "LineupAnalysis"("lineupId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupItemAnalysis_lineupItemId_key" ON "LineupItemAnalysis"("lineupItemId");

-- CreateIndex
CREATE INDEX "LineupItemAnalysis_lineupItemId_idx" ON "LineupItemAnalysis"("lineupItemId");

-- CreateIndex
CREATE INDEX "LineupCorrelation_lineupId_idx" ON "LineupCorrelation"("lineupId");

-- CreateIndex
CREATE INDEX "LineupCorrelation_gameId_idx" ON "LineupCorrelation"("gameId");

-- CreateIndex
CREATE INDEX "LineupCorrelation_type_idx" ON "LineupCorrelation"("type");

-- CreateIndex
CREATE INDEX "LineupCorrelation_qbPlayerId_idx" ON "LineupCorrelation"("qbPlayerId");

-- CreateIndex
CREATE INDEX "LineupCorrelation_teammatePlayerId_idx" ON "LineupCorrelation"("teammatePlayerId");

-- CreateIndex
CREATE INDEX "LineupCorrelation_opponentPlayerId_idx" ON "LineupCorrelation"("opponentPlayerId");

-- CreateIndex
CREATE INDEX "LineupItem_rosterSpot_idx" ON "LineupItem"("rosterSpot");

-- AddForeignKey
ALTER TABLE "LineupAnalysis" ADD CONSTRAINT "LineupAnalysis_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupItemAnalysis" ADD CONSTRAINT "LineupItemAnalysis_lineupItemId_fkey" FOREIGN KEY ("lineupItemId") REFERENCES "LineupItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupCorrelation" ADD CONSTRAINT "LineupCorrelation_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupCorrelation" ADD CONSTRAINT "LineupCorrelation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupCorrelation" ADD CONSTRAINT "LineupCorrelation_qbPlayerId_fkey" FOREIGN KEY ("qbPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupCorrelation" ADD CONSTRAINT "LineupCorrelation_teammatePlayerId_fkey" FOREIGN KEY ("teammatePlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupCorrelation" ADD CONSTRAINT "LineupCorrelation_opponentPlayerId_fkey" FOREIGN KEY ("opponentPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
