-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarAt" TIMESTAMP(3),
ADD COLUMN     "avatarKey" TEXT;

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "athleteId" TEXT,
    "coachId" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "template" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Routine_athleteId_active_idx" ON "Routine"("athleteId", "active");

-- CreateIndex
CREATE INDEX "Routine_orgId_template_idx" ON "Routine"("orgId", "template");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseLink_orgId_exerciseId_key" ON "ExerciseLink"("orgId", "exerciseId");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLink" ADD CONSTRAINT "ExerciseLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLink" ADD CONSTRAINT "ExerciseLink_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

