CREATE TABLE "schema_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text DEFAULT 'bootstrap' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
