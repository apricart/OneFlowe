CREATE TABLE "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer,
	"order_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" varchar(255),
	"processed_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "organization_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "amount_held_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "amount_credited_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_org_idx" ON "refunds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "refunds_processed_by_idx" ON "refunds" USING btree ("processed_by_user_id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budgets_org_idx" ON "budgets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "budgets_branch_idx" ON "budgets" USING btree ("branch_id");