
-- CreateTable
CREATE TABLE "RoutineCheck" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutineCheck_athleteId_date_idx" ON "RoutineCheck"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineCheck_routineId_date_rowId_key" ON "RoutineCheck"("routineId", "date", "rowId");

-- AddForeignKey
ALTER TABLE "RoutineCheck" ADD CONSTRAINT "RoutineCheck_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCheck" ADD CONSTRAINT "RoutineCheck_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

