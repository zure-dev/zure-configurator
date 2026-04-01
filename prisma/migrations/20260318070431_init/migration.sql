-- CreateEnum
CREATE TYPE "ProductFamilyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OptionDisplayType" AS ENUM ('SWATCH', 'TILE', 'THUMBNAIL', 'DROPDOWN', 'RADIO', 'TOGGLE');

-- CreateEnum
CREATE TYPE "PriceModifierType" AS ENUM ('ADDITIVE', 'PERCENTAGE', 'ABSOLUTE', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('CABINET', 'STONE_TOP', 'BASIN', 'HANDLE', 'ACCESSORY', 'TAP', 'PLUG_WASTE', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryTrackingMode" AS ENUM ('NONE', 'SOFT', 'HARD');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'IMPORT', 'EXPORT', 'ACTIVATE', 'DEACTIVATE', 'ARCHIVE');

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "shopifyDomain" TEXT NOT NULL,
    "shopifyAccessToken" TEXT NOT NULL,
    "shopifyPlan" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "timezone" TEXT NOT NULL DEFAULT 'Australia/Sydney',
    "settings" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_families" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductFamilyStatus" NOT NULL DEFAULT 'DRAFT',
    "basePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defaultMediaSet" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_family_shopify_links" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyProductNumericId" TEXT,
    "shopifyVariantId" TEXT,
    "shopifyVariantNumericId" TEXT,
    "shopifyProductHandle" TEXT,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "product_family_shopify_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_groups" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayType" "OptionDisplayType" NOT NULL DEFAULT 'TILE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "helperText" TEXT,
    "stepNumber" INTEGER,

    CONSTRAINT "option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_values" (
    "id" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "swatchColor" TEXT,
    "swatchImage" TEXT,
    "thumbnailUrl" TEXT,
    "description" TEXT,
    "metadata" JSONB,

    CONSTRAINT "option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_dependency_rules" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "whenOptionGroupSlug" TEXT NOT NULL,
    "whenOptionValueSlug" TEXT NOT NULL,
    "thenOptionGroupSlug" TEXT NOT NULL,
    "thenOptionValueSlugs" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ruleVersionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "option_dependency_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_exclusion_rules" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "whenOptionGroupSlug" TEXT NOT NULL,
    "whenOptionValueSlug" TEXT NOT NULL,
    "excludeOptionGroupSlug" TEXT NOT NULL,
    "excludeOptionValueSlugs" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ruleVersionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "option_exclusion_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "name" TEXT,
    "optionGroupSlug" TEXT NOT NULL,
    "optionValueSlug" TEXT NOT NULL,
    "priceModifier" DECIMAL(10,2) NOT NULL,
    "modifierType" "PriceModifierType" NOT NULL DEFAULT 'ADDITIVE',
    "conditions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ruleVersionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_price_rules" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "name" TEXT,
    "optionGroupSlug" TEXT NOT NULL,
    "optionValueSlug" TEXT NOT NULL,
    "priceModifier" DECIMAL(10,2) NOT NULL,
    "modifierType" "PriceModifierType" NOT NULL DEFAULT 'ADDITIVE',
    "tradeCondition" JSONB NOT NULL,
    "conditions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ruleVersionId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "trade_price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_rules" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "name" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "mediaSet" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ruleVersionId" TEXT,

    CONSTRAINT "media_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_rules" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "optionGroupSlug" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "includeInLineItem" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "summary_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "components" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_to_component_maps" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "configuration_to_component_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_policies" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "trackingMode" "InventoryTrackingMode" NOT NULL DEFAULT 'NONE',
    "currentStock" INTEGER,
    "lowStockThreshold" INTEGER,
    "leadTimeDays" INTEGER,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_sessions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "customerIdent" TEXT,
    "isTradeCustomer" BOOLEAN NOT NULL DEFAULT false,
    "selections" JSONB NOT NULL,
    "resolvedPrice" DECIMAL(10,2),
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuration_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_snapshots" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "selections" JSONB NOT NULL,
    "pricingBreakdown" JSONB NOT NULL,
    "mediaState" JSONB NOT NULL,
    "componentMappings" JSONB NOT NULL,
    "tradeState" JSONB,
    "summaryText" TEXT NOT NULL,
    "summaryStructured" JSONB NOT NULL,
    "validationSignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_resolution_records" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "shopifyCartToken" TEXT,
    "shopifyVariantId" TEXT NOT NULL,
    "lineItemProperties" JSONB NOT NULL,
    "resolvedPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_resolution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_resolution_records" (
    "id" TEXT NOT NULL,
    "cartResolutionId" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "shopifyOrderName" TEXT,
    "shopifyLineItemId" TEXT,
    "componentSkus" JSONB NOT NULL,
    "stockLogicState" JSONB,
    "leadTimeState" JSONB,
    "fulfilmentStatus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_resolution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_versions" (
    "id" TEXT NOT NULL,
    "productFamilyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "description" TEXT,
    "snapshotData" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_shopifyDomain_key" ON "stores"("shopifyDomain");

-- CreateIndex
CREATE INDEX "product_families_storeId_status_idx" ON "product_families"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "product_families_storeId_slug_key" ON "product_families"("storeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_family_shopify_links_productFamilyId_key" ON "product_family_shopify_links"("productFamilyId");

-- CreateIndex
CREATE INDEX "product_family_shopify_links_shopifyProductId_idx" ON "product_family_shopify_links"("shopifyProductId");

-- CreateIndex
CREATE INDEX "option_groups_productFamilyId_sortOrder_idx" ON "option_groups"("productFamilyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "option_groups_productFamilyId_slug_key" ON "option_groups"("productFamilyId", "slug");

-- CreateIndex
CREATE INDEX "option_values_optionGroupId_sortOrder_idx" ON "option_values"("optionGroupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "option_values_optionGroupId_slug_key" ON "option_values"("optionGroupId", "slug");

-- CreateIndex
CREATE INDEX "option_dependency_rules_productFamilyId_isActive_idx" ON "option_dependency_rules"("productFamilyId", "isActive");

-- CreateIndex
CREATE INDEX "option_exclusion_rules_productFamilyId_isActive_idx" ON "option_exclusion_rules"("productFamilyId", "isActive");

-- CreateIndex
CREATE INDEX "price_rules_productFamilyId_optionGroupSlug_optionValueSlug_idx" ON "price_rules"("productFamilyId", "optionGroupSlug", "optionValueSlug");

-- CreateIndex
CREATE INDEX "trade_price_rules_productFamilyId_optionGroupSlug_optionVal_idx" ON "trade_price_rules"("productFamilyId", "optionGroupSlug", "optionValueSlug");

-- CreateIndex
CREATE INDEX "media_rules_productFamilyId_priority_idx" ON "media_rules"("productFamilyId", "priority");

-- CreateIndex
CREATE INDEX "summary_rules_productFamilyId_sortOrder_idx" ON "summary_rules"("productFamilyId", "sortOrder");

-- CreateIndex
CREATE INDEX "components_productFamilyId_type_idx" ON "components"("productFamilyId", "type");

-- CreateIndex
CREATE INDEX "components_sku_idx" ON "components"("sku");

-- CreateIndex
CREATE INDEX "configuration_to_component_maps_productFamilyId_idx" ON "configuration_to_component_maps"("productFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_policies_componentId_key" ON "inventory_policies"("componentId");

-- CreateIndex
CREATE INDEX "configuration_sessions_storeId_status_idx" ON "configuration_sessions"("storeId", "status");

-- CreateIndex
CREATE INDEX "configuration_sessions_customerIdent_idx" ON "configuration_sessions"("customerIdent");

-- CreateIndex
CREATE INDEX "configuration_sessions_expiresAt_idx" ON "configuration_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "configuration_snapshots_sessionId_key" ON "configuration_snapshots"("sessionId");

-- CreateIndex
CREATE INDEX "configuration_snapshots_productFamilyId_idx" ON "configuration_snapshots"("productFamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_resolution_records_snapshotId_key" ON "cart_resolution_records"("snapshotId");

-- CreateIndex
CREATE INDEX "cart_resolution_records_shopifyCartToken_idx" ON "cart_resolution_records"("shopifyCartToken");

-- CreateIndex
CREATE UNIQUE INDEX "order_resolution_records_cartResolutionId_key" ON "order_resolution_records"("cartResolutionId");

-- CreateIndex
CREATE INDEX "order_resolution_records_shopifyOrderId_idx" ON "order_resolution_records"("shopifyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "rule_versions_productFamilyId_version_key" ON "rule_versions"("productFamilyId", "version");

-- CreateIndex
CREATE INDEX "audit_logs_storeId_createdAt_idx" ON "audit_logs"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_families" ADD CONSTRAINT "product_families_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_family_shopify_links" ADD CONSTRAINT "product_family_shopify_links_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_values" ADD CONSTRAINT "option_values_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_dependency_rules" ADD CONSTRAINT "option_dependency_rules_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_exclusion_rules" ADD CONSTRAINT "option_exclusion_rules_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_price_rules" ADD CONSTRAINT "trade_price_rules_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_rules" ADD CONSTRAINT "media_rules_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_rules" ADD CONSTRAINT "summary_rules_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_to_component_maps" ADD CONSTRAINT "configuration_to_component_maps_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_policies" ADD CONSTRAINT "inventory_policies_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_sessions" ADD CONSTRAINT "configuration_sessions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_snapshots" ADD CONSTRAINT "configuration_snapshots_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "configuration_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_resolution_records" ADD CONSTRAINT "cart_resolution_records_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "configuration_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_resolution_records" ADD CONSTRAINT "order_resolution_records_cartResolutionId_fkey" FOREIGN KEY ("cartResolutionId") REFERENCES "cart_resolution_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_productFamilyId_fkey" FOREIGN KEY ("productFamilyId") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
