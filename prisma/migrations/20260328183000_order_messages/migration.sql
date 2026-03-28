-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('admin', 'executor');

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "messages_order_id_idx" ON "messages"("order_id");

-- CreateIndex
CREATE INDEX "messages_order_id_created_at_idx" ON "messages"("order_id", "created_at");

-- Supabase Realtime: подписка postgres_changes на таблицу (локальный Postgres без publication просто пропускает блок)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE messages';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Чтение для anon (как у остальных таблиц в Supabase для Realtime в браузере)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON TABLE "messages" TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE "messages" TO authenticated;
  END IF;
END $$;
