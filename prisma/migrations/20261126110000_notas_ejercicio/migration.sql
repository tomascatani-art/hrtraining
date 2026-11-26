-- AlterTable
ALTER TABLE "RoutineCheck" ADD COLUMN     "kg" VARCHAR(60),
ADD COLUMN     "molestia" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" VARCHAR(300);

