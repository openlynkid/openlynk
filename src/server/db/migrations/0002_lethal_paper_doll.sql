ALTER TABLE "subscription" ADD COLUMN "order_id" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_order_id_unique" UNIQUE("order_id");