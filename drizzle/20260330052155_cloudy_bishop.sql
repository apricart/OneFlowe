DROP INDEX IF EXISTS "employee_creds_email_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "users_employee_id_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_creds_email_uq" ON "employee_credentials" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_employee_id_idx" ON "users" USING btree ("employee_id");
