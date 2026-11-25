-- CreateTable
CREATE TABLE "RoutineSnapshot" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "data" JSONB NOT NULL,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutineSnapshot_routineId_createdAt_idx" ON "RoutineSnapshot"("routineId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoutineSnapshot" ADD CONSTRAINT "RoutineSnapshot_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

