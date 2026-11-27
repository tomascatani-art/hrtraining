-- AlterTable
ALTER TABLE "AthleteProfile" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Fee" ADD COLUMN     "autoNotice" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "feeCoachOn" TEXT,
ADD COLUMN     "feeRunOn" TEXT;

