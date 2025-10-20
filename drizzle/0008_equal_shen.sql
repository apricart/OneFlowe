CREATE TABLE "modifiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(64) DEFAULT 'unit' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_modifiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"modifier_id" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifiers" ADD CONSTRAINT "product_modifiers_product_id_global_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."global_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifiers" ADD CONSTRAINT "product_modifiers_modifier_id_modifiers_id_fk" FOREIGN KEY ("modifier_id") REFERENCES "public"."modifiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "modifiers_name_idx" ON "modifiers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "modifiers_type_idx" ON "modifiers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "modifiers_status_idx" ON "modifiers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "modifiers_user_idx" ON "modifiers" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "product_modifiers_product_idx" ON "product_modifiers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_modifiers_modifier_idx" ON "product_modifiers" USING btree ("modifier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_modifiers_product_modifier_idx" ON "product_modifiers" USING btree ("product_id","modifier_id");