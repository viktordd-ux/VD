-- Per-user read state for order chat vs. rest of project (files, checkpoints, order fields).
CREATE TABLE "order_user_read_state" (
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "chat_read_at" TIMESTAMP(3),
    "project_read_at" TIMESTAMP(3),

    CONSTRAINT "order_user_read_state_pkey" PRIMARY KEY ("user_id","order_id"),
    CONSTRAINT "order_user_read_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_user_read_state_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
