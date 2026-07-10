ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "cost_center_id" varchar(128);

CREATE INDEX IF NOT EXISTS "branches_cost_center_idx" ON "branches" USING btree ("cost_center_id");
