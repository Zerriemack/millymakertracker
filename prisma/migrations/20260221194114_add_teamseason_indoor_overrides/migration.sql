-- CreateTable
CREATE TABLE "TeamSeason" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "homeIsIndoor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamSeason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamSeason_seasonYear_idx" ON "TeamSeason"("seasonYear");

-- CreateIndex
CREATE INDEX "TeamSeason_teamId_idx" ON "TeamSeason"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeason_teamId_seasonYear_key" ON "TeamSeason"("teamId", "seasonYear");

-- AddForeignKey
ALTER TABLE "TeamSeason" ADD CONSTRAINT "TeamSeason_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
