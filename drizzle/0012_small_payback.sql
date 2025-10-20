ALTER TABLE "branch_inventory" DROP CONSTRAINT "branch_inventory_global_product_id_global_products_id_fk";
--> statement-breakpoint
ALTER TABLE "branch_inventory" DROP CONSTRAINT "branch_inventory_organization_inventory_id_organization_inventory_id_fk";
--> statement-breakpoint
DROP INDEX "branch_inventory_global_product_idx";--> statement-breakpoint
ALTER TABLE "branch_inventory" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_inventory" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "branch_inventory" ADD CONSTRAINT "branch_inventory_organization_inventory_id_organization_inventory_id_fk" FOREIGN KEY ("organization_inventory_id") REFERENCES "public"."organization_inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branch_inventory_deleted_at_idx" ON "branch_inventory" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "org_inventory_deleted_at_idx" ON "organization_inventory" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "branch_inventory" DROP COLUMN "global_product_id";