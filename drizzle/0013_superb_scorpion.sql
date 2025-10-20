CREATE TABLE "employee_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(128),
	"last_name" varchar(128),
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"deactivated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "employee_credentials" ADD CONSTRAINT "employee_credentials_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_credentials" ADD CONSTRAINT "employee_credentials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_credentials" ADD CONSTRAINT "employee_credentials_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_creds_email_uq" ON "employee_credentials" USING btree ("email");--> statement-breakpoint
CREATE INDEX "employee_creds_branch_idx" ON "employee_credentials" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "employee_creds_org_idx" ON "employee_credentials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "employee_creds_active_idx" ON "employee_credentials" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "employee_creds_created_by_idx" ON "employee_credentials" USING btree ("created_by_user_id");