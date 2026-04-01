-- Список заказов: фильтр по организации + статус + сортировка по обновлению.
CREATE INDEX IF NOT EXISTS "idx_orders_org_status_updated"
  ON "orders" ("organization_id", "status", "updated_at" DESC);

-- Сообщения: составной индекс уже задан в Prisma (@@index([orderId, createdAt])).

-- Шаблоны: команда по умолчанию для Quick Create.
ALTER TABLE "order_templates" ADD COLUMN IF NOT EXISTS "team_id" TEXT;

ALTER TABLE "order_templates" DROP CONSTRAINT IF EXISTS "order_templates_team_id_fkey";
ALTER TABLE "order_templates"
  ADD CONSTRAINT "order_templates_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "order_templates_team_id_idx" ON "order_templates"("team_id");
