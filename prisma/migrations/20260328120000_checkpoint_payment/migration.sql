-- AlterEnum
ALTER TYPE "CheckpointStatus" ADD VALUE 'awaiting_approval';

-- AlterTable
ALTER TABLE "checkpoints" ADD COLUMN "payment_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "checkpoints" ADD COLUMN "payout_released_at" TIMESTAMP(3);

-- Уже завершённые этапы считаем выплаченными (дата — последнее обновление записи)
UPDATE "checkpoints" SET "payout_released_at" = "updated_at" WHERE "status" = 'done';
