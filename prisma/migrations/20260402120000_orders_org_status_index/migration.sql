-- Списки заказов по организации и статусу (фильтры админки).
CREATE INDEX IF NOT EXISTS "orders_organization_id_status_idx" ON "orders" ("organization_id", "status");
