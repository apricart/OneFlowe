CREATE TABLE "refund_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"refund_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "groups_org_name_uq";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status_at_refund" varchar(32);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "receipt_data" jsonb;--> statement-breakpoint
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refund_items_refund_idx" ON "refund_items" USING btree ("refund_id");--> statement-breakpoint
CREATE INDEX "refund_items_order_item_idx" ON "refund_items" USING btree ("order_item_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_by_user_id_users_id_fk" FOREIGN KEY ("refunded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_action_idx" ON "audit_logs" USING btree ("created_at","action");--> statement-breakpoint
CREATE INDEX "branch_inventory_status_idx" ON "branch_inventory" USING btree ("branch_id","is_visible","is_active");--> statement-breakpoint
CREATE INDEX "global_products_cat_status_idx" ON "global_products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "global_products_status_created_idx" ON "global_products" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "order_items_product_order_idx" ON "order_items" USING btree ("global_product_id","order_id");--> statement-breakpoint
CREATE INDEX "orders_branch_status_created_idx" ON "orders" USING btree ("branch_id","status","created_at");--> statement-breakpoint
CREATE INDEX "orders_org_created_idx" ON "orders" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "org_code_idx" ON "organizations" USING btree ("code");