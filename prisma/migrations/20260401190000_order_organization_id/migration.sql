-- AlterTable
ALTER TABLE "orders" ADD COLUMN "organization_id" TEXT;

-- Backfill: организация «Default» (первый admin — владелец), все пользователи в Membership, все заказы привязаны к org.
DO $$
DECLARE
  first_admin_id TEXT;
  org_id TEXT;
BEGIN
  SELECT u.id INTO first_admin_id
  FROM users u
  WHERE u.role = 'admin'::"UserRole"
  ORDER BY u.created_at ASC
  LIMIT 1;

  SELECT o.id INTO org_id
  FROM organizations o
  WHERE o.name = 'Default'
  ORDER BY o.created_at ASC
  LIMIT 1;

  IF org_id IS NULL THEN
    IF first_admin_id IS NULL THEN
      RAISE EXCEPTION 'Backfill: нет пользователя с ролью admin для организации Default';
    END IF;

    org_id := gen_random_uuid()::text;
    INSERT INTO organizations (id, name, owner_id, created_at)
    VALUES (org_id, 'Default', first_admin_id, NOW());

    INSERT INTO memberships (id, user_id, organization_id, role, created_at)
    VALUES (gen_random_uuid()::text, first_admin_id, org_id, 'OWNER', NOW());

    INSERT INTO memberships (id, user_id, organization_id, role, created_at)
    SELECT gen_random_uuid()::text, u.id, org_id,
      CASE
        WHEN u.role = 'admin'::"UserRole" THEN 'ADMIN'::"MembershipRole"
        WHEN u.role = 'executor'::"UserRole" THEN 'EXECUTOR'::"MembershipRole"
        ELSE 'VIEWER'::"MembershipRole"
      END,
      NOW()
    FROM users u
    WHERE u.id <> first_admin_id
    ON CONFLICT ("user_id", "organization_id") DO NOTHING;
  ELSE
    INSERT INTO memberships (id, user_id, organization_id, role, created_at)
    SELECT gen_random_uuid()::text, u.id, org_id,
      CASE
        WHEN u.id = (SELECT o2.owner_id FROM organizations o2 WHERE o2.id = org_id) THEN 'OWNER'::"MembershipRole"
        WHEN u.role = 'admin'::"UserRole" THEN 'ADMIN'::"MembershipRole"
        WHEN u.role = 'executor'::"UserRole" THEN 'EXECUTOR'::"MembershipRole"
        ELSE 'VIEWER'::"MembershipRole"
      END,
      NOW()
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = u.id AND m.organization_id = org_id
    )
    ON CONFLICT ("user_id", "organization_id") DO NOTHING;
  END IF;

  UPDATE orders SET organization_id = org_id WHERE organization_id IS NULL;
END $$;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "organization_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "orders_organization_id_idx" ON "orders"("organization_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
