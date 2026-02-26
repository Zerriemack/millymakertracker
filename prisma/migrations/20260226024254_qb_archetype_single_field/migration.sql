/*
  Warnings:

  - You are about to drop the column `roleArchetype` on the `QbSeason` table. All the data in the column will be lost.
  - You are about to drop the column `styleArchetype` on the `QbSeason` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "QbArchetype" AS ENUM ('ROOKIE', 'BACKUP', 'BRIDGE', 'JOURNEYMAN', 'FRANCHISE', 'GUNSLINGER', 'GAME_MANAGER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "QbSeason" DROP COLUMN "roleArchetype",
DROP COLUMN "styleArchetype",
ADD COLUMN     "archetype" "QbArchetype" NOT NULL DEFAULT 'UNKNOWN';

-- DropEnum
DROP TYPE "QbRoleArchetype";

-- DropEnum
DROP TYPE "QbStyleArchetype";
