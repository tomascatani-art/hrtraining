-- CreateTable
CREATE TABLE "Anthropometry" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "measuredById" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "sittingHeightCm" DOUBLE PRECISION,
    "armSpanCm" DOUBLE PRECISION,
    "triceps" DOUBLE PRECISION,
    "subscapular" DOUBLE PRECISION,
    "supraspinale" DOUBLE PRECISION,
    "abdominal" DOUBLE PRECISION,
    "thigh" DOUBLE PRECISION,
    "calf" DOUBLE PRECISION,
    "armRelaxedCm" DOUBLE PRECISION,
    "armFlexedCm" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "thighMidCm" DOUBLE PRECISION,
    "calfGirthCm" DOUBLE PRECISION,
    "note" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anthropometry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anthropometry_athleteId_date_idx" ON "Anthropometry"("athleteId", "date");

-- AddForeignKey
ALTER TABLE "Anthropometry" ADD CONSTRAINT "Anthropometry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anthropometry" ADD CONSTRAINT "Anthropometry_measuredById_fkey" FOREIGN KEY ("measuredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

