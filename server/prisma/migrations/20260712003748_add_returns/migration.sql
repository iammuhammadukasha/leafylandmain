-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('requested', 'approved', 'rejected', 'refunded');

-- CreateTable
CREATE TABLE "returns" (
    "id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'requested',
    "resolved_by" UUID,
    "refund_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "returns_order_line_id_key" ON "returns"("order_line_id");

-- CreateIndex
CREATE INDEX "returns_order_line_id_idx" ON "returns"("order_line_id");

-- CreateIndex
CREATE INDEX "returns_status_idx" ON "returns"("status");
