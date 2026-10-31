-- AlterTable
ALTER TABLE "ContactSubmission" ADD COLUMN     "formTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ContactSubmission_formTokenHash_key" ON "ContactSubmission"("formTokenHash");

-- CreateIndex
CREATE INDEX "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "ContactSubmission_ipHash_createdAt_idx" ON "ContactSubmission"("ipHash", "createdAt");
