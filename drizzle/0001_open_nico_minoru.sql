ALTER TABLE "branches" DROP CONSTRAINT "branches_admin_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "code" varchar(64);--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "status" varchar(32) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "code" varchar(64);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logo_url" varchar(512);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login_code" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mfa_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_status_idx" ON "branches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_login_code_idx" ON "users" USING btree ("login_code");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_branch_idx" ON "users" USING btree ("branch_id");