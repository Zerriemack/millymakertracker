-- CreateTable
CREATE TABLE "ContestAnalysis" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "stackSummary" TEXT,
    "uniquenessNotes" TEXT,
    "stackMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContestAnalysis_contestId_key" ON "ContestAnalysis"("contestId");

-- CreateIndex
CREATE INDEX "ContestAnalysis_contestId_idx" ON "ContestAnalysis"("contestId");

-- AddForeignKey
ALTER TABLE "ContestAnalysis" ADD CONSTRAINT "ContestAnalysis_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
