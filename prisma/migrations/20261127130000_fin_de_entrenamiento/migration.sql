-- CreateTable
CREATE TABLE "RoutineSession" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayId" TEXT NOT NULL,
    "rpe" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "load" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutineSession_athleteId_date_idx" ON "RoutineSession"("athleteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineSession_routineId_date_dayId_key" ON "RoutineSession"("routineId", "date", "dayId");

-- AddForeignKey
ALTER TABLE "RoutineSession" ADD CONSTRAINT "RoutineSession_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineSession" ADD CONSTRAINT "RoutineSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

