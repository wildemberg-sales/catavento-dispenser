ALTER TYPE "public"."work_log_outcome" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "import_batch_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_data" jsonb NOT NULL,
	"external_ref" text,
	"source" "source_type",
	"priority" integer,
	"payload" jsonb,
	"is_valid" boolean DEFAULT true NOT NULL,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE "queue_priority_rules" (
	"source" "source_type" PRIMARY KEY NOT NULL,
	"priority" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batch_rows_batch_id_idx" ON "import_batch_rows" USING btree ("batch_id");--> statement-breakpoint
INSERT INTO "queue_priority_rules" ("source", "priority") VALUES
	('mercado_livre', 2),
	('shopee', 1),
	('ebay', 0)
ON CONFLICT ("source") DO NOTHING;