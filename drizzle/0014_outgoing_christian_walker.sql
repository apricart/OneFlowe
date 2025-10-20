ALTER TABLE "order_items" DROP CONSTRAINT "order_items_sku_id_skus_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "global_product_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_code" varchar(128);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tid" varchar(26) NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("global_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_tid_idx" ON "orders" USING btree ("tid");--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "sku_id";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tid_unique" UNIQUE("tid");