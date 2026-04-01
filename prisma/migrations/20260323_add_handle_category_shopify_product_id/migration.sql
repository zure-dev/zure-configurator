-- Add handle column (mirrors slug, will become the canonical identifier)
ALTER TABLE "product_families" ADD COLUMN "handle" TEXT;

-- Backfill handle from slug for any existing rows
UPDATE "product_families" SET "handle" = "slug" WHERE "handle" IS NULL;

-- Now make handle NOT NULL
ALTER TABLE "product_families" ALTER COLUMN "handle" SET NOT NULL;

-- Add category column (nullable, free-text for now)
ALTER TABLE "product_families" ADD COLUMN "category" TEXT;

-- Add shopify_product_id directly on the model (denormalized for fast lookup)
ALTER TABLE "product_families" ADD COLUMN "shopify_product_id" TEXT;

-- Add unique constraint on (storeId, handle)
CREATE UNIQUE INDEX "product_families_storeId_handle_key" ON "product_families"("storeId", "handle");

-- Add index for category queries
CREATE INDEX "product_families_storeId_category_idx" ON "product_families"("storeId", "category");
