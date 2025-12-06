ALTER TABLE "refunds"
  ADD COLUMN IF NOT EXISTS "status" varchar(16) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "requested_by_user_id" uuid REFERENCES "users"("id"),
  ALTER COLUMN "processed_by_user_id" DROP NOT NULL;


