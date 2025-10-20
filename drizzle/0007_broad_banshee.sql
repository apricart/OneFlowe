CREATE TABLE "mfa_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"type" varchar(20) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "mfa_codes" ADD CONSTRAINT "mfa_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mfa_codes_user_idx" ON "mfa_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_codes_code_idx" ON "mfa_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "mfa_codes_expires_idx" ON "mfa_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mfa_codes_type_idx" ON "mfa_codes" USING btree ("type");