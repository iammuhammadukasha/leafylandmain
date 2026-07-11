-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('pending', 'verified', 'rejected', 'revoked');

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'pending',
    "commission_rate_bps" INTEGER,
    "verified_at" TIMESTAMPTZ,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_owner_user_id_idx" ON "vendors"("owner_user_id");

-- CreateIndex
CREATE INDEX "user_roles_vendor_id_idx" ON "user_roles"("vendor_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
