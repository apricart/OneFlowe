CREATE TABLE "system_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" varchar(255),
	"user_role" varchar(64),
	"user_email" varchar(255),
	"organization_id" integer,
	"branch_id" integer,
	"action" varchar(128) NOT NULL,
	"resource_type" varchar(64) NOT NULL,
	"resource_id" varchar(128),
	"details" jsonb,
	"ip_address" varchar(64),
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rejected_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_logs_user_idx" ON "system_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_logs_action_idx" ON "system_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "system_logs_resource_idx" ON "system_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "system_logs_timestamp_idx" ON "system_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "system_logs_org_idx" ON "system_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "system_logs_branch_idx" ON "system_logs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "system_logs_role_idx" ON "system_logs" USING btree ("user_role");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rejected_by_user_id_users_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;