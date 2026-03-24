-- Add Stadium model and relation to Game
CREATE TABLE "Stadium" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isIndoor" BOOLEAN NOT NULL,
  "teamAbbreviation" TEXT,
  "activeFromSeason" INTEGER,
  "activeToSeason" INTEGER,
  "aliases" JSONB,

  CONSTRAINT "Stadium_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Stadium_teamAbbreviation_idx" ON "Stadium"("teamAbbreviation");
CREATE INDEX "Stadium_activeFromSeason_idx" ON "Stadium"("activeFromSeason");
CREATE INDEX "Stadium_activeToSeason_idx" ON "Stadium"("activeToSeason");
CREATE INDEX "Stadium_name_idx" ON "Stadium"("name");
CREATE INDEX "Stadium_city_idx" ON "Stadium"("city");
CREATE INDEX "Stadium_state_idx" ON "Stadium"("state");

ALTER TABLE "Game" ADD COLUMN "stadiumId" TEXT;

CREATE INDEX "Game_stadiumId_idx" ON "Game"("stadiumId");

ALTER TABLE "Game"
  ADD CONSTRAINT "Game_stadiumId_fkey"
  FOREIGN KEY ("stadiumId") REFERENCES "Stadium"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
