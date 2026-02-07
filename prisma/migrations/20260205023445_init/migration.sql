-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('NFL', 'CFB');

-- CreateEnum
CREATE TYPE "LineupType" AS ENUM ('CLASSIC', 'SHOWDOWN');

-- CreateEnum
CREATE TYPE "SlateType" AS ENUM ('MAIN', 'SHOWDOWN', 'TNF', 'SNF', 'MNF', 'OTHER');

-- CreateEnum
CREATE TYPE "RosterSpot" AS ENUM ('QB', 'RB', 'WR', 'TE', 'FLEX', 'DST', 'CAPTAIN');

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sport" "Sport" NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slate" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "week" INTEGER,
    "slateType" "SlateType" NOT NULL,
    "slateDate" TIMESTAMP(3) NOT NULL,
    "lineupType" "LineupType" NOT NULL,
    "salaryCapCents" INTEGER,
    "gamesCount" INTEGER,
    "dayOfWeek" INTEGER,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "slateKey" TEXT NOT NULL,
    "slateName" TEXT,
    "slateTag" TEXT,
    "slateGroup" TEXT,

    CONSTRAINT "Slate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "slateId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "siteContestId" TEXT,
    "contestName" TEXT NOT NULL,
    "entryFeeCents" INTEGER,
    "entries" INTEGER,
    "topPrizeCents" INTEGER,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "maxEntries" INTEGER,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "dkPlayerId" INTEGER,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "lineupType" "LineupType" NOT NULL,
    "salaryUsed" INTEGER,
    "totalPoints" DOUBLE PRECISION,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupItem" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rosterSpot" "RosterSpot" NOT NULL,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "salary" INTEGER,
    "points" DOUBLE PRECISION,
    "ownership" DOUBLE PRECISION,

    CONSTRAINT "LineupItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Season_year_sport_key" ON "Season"("year", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_slateKey_key" ON "Slate"("slateKey");

-- CreateIndex
CREATE INDEX "Slate_seasonId_idx" ON "Slate"("seasonId");

-- CreateIndex
CREATE INDEX "Slate_seasonId_week_idx" ON "Slate"("seasonId", "week");

-- CreateIndex
CREATE INDEX "Slate_seasonId_lineupType_idx" ON "Slate"("seasonId", "lineupType");

-- CreateIndex
CREATE INDEX "Slate_slateTag_idx" ON "Slate"("slateTag");

-- CreateIndex
CREATE INDEX "Slate_slateGroup_idx" ON "Slate"("slateGroup");

-- CreateIndex
CREATE INDEX "Contest_slateId_idx" ON "Contest"("slateId");

-- CreateIndex
CREATE INDEX "Contest_site_idx" ON "Contest"("site");

-- CreateIndex
CREATE UNIQUE INDEX "Contest_site_siteContestId_key" ON "Contest"("site", "siteContestId");

-- CreateIndex
CREATE INDEX "Winner_contestId_idx" ON "Winner"("contestId");

-- CreateIndex
CREATE INDEX "Winner_username_idx" ON "Winner"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Winner_contestId_username_key" ON "Winner"("contestId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Team_sport_abbreviation_key" ON "Team"("sport", "abbreviation");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Player_sport_idx" ON "Player"("sport");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sport_dkPlayerId_key" ON "Player"("sport", "dkPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sport_name_position_teamId_key" ON "Player"("sport", "name", "position", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_winnerId_key" ON "Lineup"("winnerId");

-- CreateIndex
CREATE INDEX "Lineup_lineupType_idx" ON "Lineup"("lineupType");

-- CreateIndex
CREATE INDEX "LineupItem_lineupId_idx" ON "LineupItem"("lineupId");

-- CreateIndex
CREATE INDEX "LineupItem_playerId_idx" ON "LineupItem"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupItem_lineupId_rosterSpot_slotIndex_key" ON "LineupItem"("lineupId", "rosterSpot", "slotIndex");

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_slateId_fkey" FOREIGN KEY ("slateId") REFERENCES "Slate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Winner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupItem" ADD CONSTRAINT "LineupItem_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupItem" ADD CONSTRAINT "LineupItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
