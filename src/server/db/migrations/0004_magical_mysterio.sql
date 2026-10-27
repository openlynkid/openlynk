CREATE TABLE "creator_link" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"type" text DEFAULT 'link' NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"description" text,
	"icon" text,
	"thumbnail_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"seo_title" text,
	"seo_description" text,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_domain" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price" integer DEFAULT 0 NOT NULL,
	"compare_at_price" integer,
	"cover_image_url" text,
	"product_type" text DEFAULT 'digital' NOT NULL,
	"delivery_type" text DEFAULT 'file' NOT NULL,
	"delivery_url" text,
	"license_prefix" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_event" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"event_type" text NOT NULL,
	"target_id" text,
	"referrer" text,
	"country" text,
	"device" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"buyer_user_id" text,
	"buyer_email" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"license_key" text,
	"download_token" text NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "store_order" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"product_id" text NOT NULL,
	"buyer_user_id" text,
	"buyer_email" text NOT NULL,
	"buyer_name" text,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"snap_token" text,
	"snap_redirect_url" text,
	"payment_type" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"gross_amount" integer NOT NULL,
	"payment_type" text NOT NULL,
	"transaction_status" text NOT NULL,
	"fraud_status" text,
	"status_code" text NOT NULL,
	"status_message" text,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"gateway" text DEFAULT 'midtrans' NOT NULL,
	"order_id" text,
	"signature" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processing_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_link" ADD CONSTRAINT "creator_link_profile_id_creator_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profile" ADD CONSTRAINT "creator_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_profile_id_creator_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_asset" ADD CONSTRAINT "product_asset_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_profile_id_creator_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_order_id_store_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_profile_id_creator_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order" ADD CONSTRAINT "store_order_profile_id_creator_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order" ADD CONSTRAINT "store_order_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order" ADD CONSTRAINT "store_order_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_transaction" ADD CONSTRAINT "store_transaction_order_id_store_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creator_link_profile_position_idx" ON "creator_link" USING btree ("profile_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_profile_user_id_unique" ON "creator_profile" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_profile_username_unique" ON "creator_profile" USING btree ("username");--> statement-breakpoint
CREATE INDEX "creator_profile_custom_domain_idx" ON "creator_profile" USING btree ("custom_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "product_profile_slug_unique" ON "product" USING btree ("profile_id","slug");--> statement-breakpoint
CREATE INDEX "product_profile_position_idx" ON "product" USING btree ("profile_id","position");--> statement-breakpoint
CREATE INDEX "product_asset_product_position_idx" ON "product_asset" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "analytics_event_profile_created_idx" ON "analytics_event" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_event_profile_type_created_idx" ON "analytics_event" USING btree ("profile_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_event_target_idx" ON "analytics_event" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "purchase_profile_created_idx" ON "purchase" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "purchase_buyer_email_idx" ON "purchase" USING btree ("buyer_email");--> statement-breakpoint
CREATE INDEX "purchase_buyer_user_idx" ON "purchase" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "purchase_download_token_idx" ON "purchase" USING btree ("download_token");--> statement-breakpoint
CREATE INDEX "purchase_product_status_idx" ON "purchase" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "store_order_profile_created_idx" ON "store_order" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "store_order_product_idx" ON "store_order" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "store_order_buyer_idx" ON "store_order" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "store_order_status_idx" ON "store_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "store_webhook_event_order_idx" ON "store_webhook_event" USING btree ("order_id");