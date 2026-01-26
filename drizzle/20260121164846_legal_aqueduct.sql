CREATE TABLE "group_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"group_id" integer,
	"action" varchar(128) NOT NULL,
	"performed_by_user_id" uuid NOT NULL,
	"performed_by_role" varchar(64) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "group_products" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "group_products" CASCADE;--> statement-breakpoint
ALTER TABLE "branches" DROP CONSTRAINT "branches_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_group_id_groups_id_fk";
--> statement-breakpoint
DROP INDEX "budgets_group_idx";--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "created_by_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "group_audit_logs" ADD CONSTRAINT "group_audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_audit_logs" ADD CONSTRAINT "group_audit_logs_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_audit_logs" ADD CONSTRAINT "group_audit_logs_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_audit_org_idx" ON "group_audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "group_audit_group_idx" ON "group_audit_logs" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_audit_action_idx" ON "group_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "group_audit_user_idx" ON "group_audit_logs" USING btree ("performed_by_user_id");--> statement-breakpoint
CREATE INDEX "group_audit_timestamp_idx" ON "group_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "groups_name_idx" ON "groups" USING btree ("name");--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN "group_id";