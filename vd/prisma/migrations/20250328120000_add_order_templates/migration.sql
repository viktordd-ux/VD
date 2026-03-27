-- CreateTable
CREATE TABLE "order_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description_template" TEXT NOT NULL,
    "default_checkpoints" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_templates_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "required_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "template_id" TEXT;

-- CreateIndex
CREATE INDEX "orders_template_id_idx" ON "orders"("template_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "order_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
