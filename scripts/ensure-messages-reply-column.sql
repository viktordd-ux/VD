-- Если миграция reply_to_id не применялась к продакшен-БД, Prisma падает на SELECT/INSERT.
-- Выполните один раз в Supabase → SQL Editor (идемпотентно).

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_reply_to_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_reply_to_id_fkey
      FOREIGN KEY (reply_to_id) REFERENCES public.messages (id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON public.messages (reply_to_id);
