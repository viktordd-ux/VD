-- AlterTable
ALTER TABLE "checkpoints" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "checkpoints_order_id_position_idx" ON "checkpoints"("order_id", "position");

-- Backfill order of stages (due date, then creation time)
UPDATE "checkpoints" AS c
SET "position" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY order_id
    ORDER BY due_date ASC NULLS LAST, created_at ASC
  ) - 1 AS rn
  FROM checkpoints
) AS sub
WHERE c.id = sub.id;
