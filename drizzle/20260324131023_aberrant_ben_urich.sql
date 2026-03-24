ALTER TABLE "users" ADD COLUMN "employee_id" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "imprest_holder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "contact_person" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "users_employee_id_idx" ON "users" USING btree ("employee_id");