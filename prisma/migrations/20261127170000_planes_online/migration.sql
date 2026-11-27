-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "blurb" TEXT,
ADD COLUMN     "forSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "PlanRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "routineId" TEXT,
    "planName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'NUEVO',
    "mpPaymentId" TEXT,
    "athleteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanRequest_mpPaymentId_key" ON "PlanRequest"("mpPaymentId");

-- CreateIndex
CREATE INDEX "PlanRequest_orgId_status_idx" ON "PlanRequest"("orgId", "status");

-- AddForeignKey
ALTER TABLE "PlanRequest" ADD CONSTRAINT "PlanRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRequest" ADD CONSTRAINT "PlanRequest_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

