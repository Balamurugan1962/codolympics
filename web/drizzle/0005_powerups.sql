CREATE TABLE "blackout" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"by_id" text NOT NULL,
	"seconds" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "powerup" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"duration_seconds" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"max_held" integer,
	"max_purchases" integer,
	"usable_phases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "powerup_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"powerup_id" bigint,
	"actor_id" text NOT NULL,
	"target_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"request_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "powerup_event_idempotent" UNIQUE("actor_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "powerup_inventory" (
	"participant_id" text NOT NULL,
	"powerup_id" bigint NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"purchased" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "powerup_inventory_participant_id_powerup_id_pk" PRIMARY KEY("participant_id","powerup_id")
);
--> statement-breakpoint
ALTER TABLE "contest" ADD COLUMN "marketplace_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blackout" ADD CONSTRAINT "blackout_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blackout" ADD CONSTRAINT "blackout_by_id_participant_user_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerup_event" ADD CONSTRAINT "powerup_event_powerup_id_powerup_id_fk" FOREIGN KEY ("powerup_id") REFERENCES "public"."powerup"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerup_event" ADD CONSTRAINT "powerup_event_actor_id_participant_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerup_event" ADD CONSTRAINT "powerup_event_target_id_participant_user_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerup_inventory" ADD CONSTRAINT "powerup_inventory_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powerup_inventory" ADD CONSTRAINT "powerup_inventory_powerup_id_powerup_id_fk" FOREIGN KEY ("powerup_id") REFERENCES "public"."powerup"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blackout_participant_idx" ON "blackout" USING btree ("participant_id","ends_at");--> statement-breakpoint
CREATE INDEX "powerup_event_actor_idx" ON "powerup_event" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "powerup_event_target_idx" ON "powerup_event" USING btree ("target_id");