-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "totalOwnershipBp" INTEGER;

-- AlterTable
ALTER TABLE "Lineup" ADD COLUMN     "totalOwnershipBp" INTEGER;

-- AlterTable
ALTER TABLE "LineupItem" ADD COLUMN     "ownershipBp" INTEGER;
