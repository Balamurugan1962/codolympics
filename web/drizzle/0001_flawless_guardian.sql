ALTER TABLE "p1_hack_question" ADD COLUMN "breaking_input" text;--> statement-breakpoint
ALTER TABLE "p1_hack_question" ADD COLUMN "verified_elsewhere" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "p1_question" ADD COLUMN "verified_elsewhere" boolean DEFAULT false NOT NULL;