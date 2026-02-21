/*
  Warnings:

  - A unique constraint covering the columns `[sport,gsisId]` on the table `Player` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "gsisId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_sport_gsisId_key" ON "Player"("sport", "gsisId");
