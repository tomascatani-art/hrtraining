-- AlterTable
ALTER TABLE "AthleteProfile" ADD COLUMN     "feeAmount" DOUBLE PRECISION,
ADD COLUMN     "paused" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "color" SET DEFAULT '#ffd60a';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "feeAmount" DOUBLE PRECISION,
ADD COLUMN     "feeDueDay" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "SessionExercise" ADD COLUMN     "block" TEXT;

-- CreateTable
CREATE TABLE "ExerciseRM" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setById" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ENTRENADOR',
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExerciseRM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemNote" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "ItemNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fee" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseRM_athleteId_exerciseId_date_idx" ON "ExerciseRM"("athleteId", "exerciseId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ItemNote_logId_itemId_key" ON "ItemNote"("logId", "itemId");

-- CreateIndex
CREATE INDEX "Fee_orgId_period_idx" ON "Fee"("orgId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Fee_athleteId_period_key" ON "Fee"("athleteId", "period");

-- AddForeignKey
ALTER TABLE "ExerciseRM" ADD CONSTRAINT "ExerciseRM_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseRM" ADD CONSTRAINT "ExerciseRM_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseRM" ADD CONSTRAINT "ExerciseRM_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNote" ADD CONSTRAINT "ItemNote_logId_fkey" FOREIGN KEY ("logId") REFERENCES "WorkoutLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNote" ADD CONSTRAINT "ItemNote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

