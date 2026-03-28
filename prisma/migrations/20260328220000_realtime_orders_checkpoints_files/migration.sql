-- Realtime: этапы и файлы должны доходить до исполнителя (postgres_changes + publication + чтение для anon)
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['orders', 'checkpoints', 'files']
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON TABLE public.orders TO anon;
    GRANT SELECT ON TABLE public.checkpoints TO anon;
    GRANT SELECT ON TABLE public.files TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON TABLE public.orders TO authenticated;
    GRANT SELECT ON TABLE public.checkpoints TO authenticated;
    GRANT SELECT ON TABLE public.files TO authenticated;
  END IF;
END $$;
