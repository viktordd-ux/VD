-- order_id на реакциях: фильтр Realtime по заказу без глобальной подписки.
ALTER TABLE "message_reactions" ADD COLUMN IF NOT EXISTS "order_id" TEXT;

UPDATE "message_reactions" AS mr
SET "order_id" = m."order_id"
FROM "messages" AS m
WHERE mr."message_id" = m."id"
  AND (mr."order_id" IS NULL OR mr."order_id" = '');

DELETE FROM "message_reactions" WHERE "order_id" IS NULL;

ALTER TABLE "message_reactions" ALTER COLUMN "order_id" SET NOT NULL;

ALTER TABLE "message_reactions" DROP CONSTRAINT IF EXISTS "message_reactions_order_id_fkey";

ALTER TABLE "message_reactions"
  ADD CONSTRAINT "message_reactions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "message_reactions_order_id_idx" ON "message_reactions"("order_id");
