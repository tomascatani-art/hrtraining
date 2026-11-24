-- AlterTable
ALTER TABLE "Fee" ADD COLUMN     "mpPaymentId" TEXT,
ADD COLUMN     "paidVia" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "mpToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Fee_mpPaymentId_key" ON "Fee"("mpPaymentId");

