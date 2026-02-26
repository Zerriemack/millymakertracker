-- Simplify QbSeason to core fields only
ALTER TABLE "QbSeason"
  ADD COLUMN "pffPassGrade" DOUBLE PRECISION;

ALTER TABLE "QbSeason"
  DROP COLUMN "qualityMetric",
  DROP COLUMN "qualityScore",
  DROP COLUMN "pffPassingSummary",
  DROP COLUMN "dropbacks";
