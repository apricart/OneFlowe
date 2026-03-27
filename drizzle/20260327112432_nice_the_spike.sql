ALTER TABLE "users" ALTER COLUMN "imprest_holder" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "imprest_holder" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "imprest_holder" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_credentials" ADD COLUMN "username" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_creds_username_uq" ON "employee_credentials" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");