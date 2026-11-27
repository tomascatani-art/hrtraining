-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "dailyRunOn" TEXT,
ADD COLUMN     "digestOn" TEXT;

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "endNotice" INTEGER NOT NULL DEFAULT 0;

