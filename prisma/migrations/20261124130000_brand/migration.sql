ALTER TABLE "Organization" ADD COLUMN "slug" TEXT, ADD COLUMN "brandName" TEXT, ADD COLUMN "brandColor" TEXT, ADD COLUMN "logoKey" TEXT, ADD COLUMN "logoMime" TEXT;
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
