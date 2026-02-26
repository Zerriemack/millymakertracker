-- Remove deprecated QB season EPA fields
ALTER TABLE "QbSeason" DROP COLUMN IF EXISTS "epaPerDropback";
