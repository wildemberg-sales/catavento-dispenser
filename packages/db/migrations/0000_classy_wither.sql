CREATE TYPE "public"."import_source_type" AS ENUM('csv', 'xlsx');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."queue_item_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled', 'problem');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'operator');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('mercado_livre', 'shopee', 'ebay');--> statement-breakpoint
CREATE TYPE "public"."work_log_outcome" AS ENUM('completed', 'abandoned', 'problem');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"source_type" "import_source_type" NOT NULL,
	"imported_by" uuid,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"valid_items" integer DEFAULT 0 NOT NULL,
	"rejected_items" integer DEFAULT 0 NOT NULL,
	"status" "import_status" DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"source" "source_type" NOT NULL,
	"sku" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"external_ref" text NOT NULL,
	"source" "source_type" NOT NULL,
	"product_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"sequence" bigserial NOT NULL,
	"status" "queue_item_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_item_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_seconds" integer,
	"outcome" "work_log_outcome",
	"problem_note" text
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_items" ADD CONSTRAINT "queue_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_queue_item_id_queue_items_id_fk" FOREIGN KEY ("queue_item_id") REFERENCES "public"."queue_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_skus_source_sku_unique" ON "product_skus" USING btree ("source","sku");--> statement-breakpoint
CREATE INDEX "product_skus_product_id_idx" ON "product_skus" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "queue_items_dequeue_idx" ON "queue_items" USING btree ("status","priority" DESC NULLS LAST,"sequence");--> statement-breakpoint
CREATE INDEX "queue_items_product_id_idx" ON "queue_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "queue_items_batch_id_idx" ON "queue_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "work_logs_operator_started_idx" ON "work_logs" USING btree ("operator_id","started_at");--> statement-breakpoint
CREATE INDEX "work_logs_queue_item_idx" ON "work_logs" USING btree ("queue_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_logs_one_active_per_item" ON "work_logs" USING btree ("queue_item_id") WHERE completed_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "work_logs_one_active_per_operator" ON "work_logs" USING btree ("operator_id") WHERE completed_at IS NULL;--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");