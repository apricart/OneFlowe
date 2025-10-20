ALTER TABLE "branch_products" DROP CONSTRAINT "branch_products_organization_product_id_organization_products_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_products" DROP CONSTRAINT "organization_products_branch_id_branches_id_fk";
--> statement-breakpoint
DROP INDEX "org_products_branch_idx";--> statement-breakpoint
DROP INDEX "org_products_org_product_uq";--> statement-breakpoint
ALTER TABLE "branch_products" ADD COLUMN "is_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "override_level" varchar(32) DEFAULT 'super_admin';--> statement-breakpoint
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_organization_product_id_organization_products_id_fk" FOREIGN KEY ("organization_product_id") REFERENCES "public"."organization_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branch_products_visible_idx" ON "branch_products" USING btree ("is_visible");--> statement-breakpoint
CREATE UNIQUE INDEX "org_products_org_product_uq" ON "organization_products" USING btree ("organization_id","global_product_id");--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "branch_id";--> statement-breakpoint
ALTER TABLE "organization_products" DROP COLUMN "override_source";