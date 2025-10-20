DROP INDEX "org_products_org_product_uq";--> statement-breakpoint
ALTER TABLE "organization_products" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "organization_products" ADD CONSTRAINT "organization_products_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_products_branch_idx" ON "organization_products" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_products_org_product_uq" ON "organization_products" USING btree ("organization_id","branch_id","global_product_id");