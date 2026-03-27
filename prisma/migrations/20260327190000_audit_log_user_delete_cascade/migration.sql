-- Allow deleting users: remove audit rows they authored (RESTRICT blocked deletes).
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_changed_by_fkey";

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
