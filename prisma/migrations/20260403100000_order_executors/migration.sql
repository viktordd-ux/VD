-- Несколько исполнителей на заказ (join). Legacy `orders.executor_id` — основной / fallback.
CREATE TABLE "order_executors" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "order_executors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_executors_order_id_user_id_key" ON "order_executors"("order_id", "user_id");
CREATE INDEX "order_executors_user_id_idx" ON "order_executors"("user_id");

ALTER TABLE "order_executors" ADD CONSTRAINT "order_executors_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_executors" ADD CONSTRAINT "order_executors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "order_executors" ("id", "order_id", "user_id")
SELECT gen_random_uuid()::text, "id", "executor_id"
FROM "orders"
WHERE "executor_id" IS NOT NULL;
