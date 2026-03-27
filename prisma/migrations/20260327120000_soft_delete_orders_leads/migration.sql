-- Soft delete: скрытые записи не участвуют в выборках (deletedAt IS NULL).
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "leads_deleted_at_idx" ON "leads"("deleted_at");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "orders_deleted_at_idx" ON "orders"("deleted_at");
