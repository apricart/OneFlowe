DROP INDEX "employee_creds_email_uq";--> statement-breakpoint
DROP INDEX "users_employee_id_idx";--> statement-breakpoint
CREATE INDEX "employee_creds_email_uq" ON "employee_credentials" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_employee_id_idx" ON "users" USING btree ("employee_id");