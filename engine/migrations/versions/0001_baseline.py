"""Baseline: the schema exactly as the web app's Drizzle migrations 0000-0005 left it.

An existing database that Drizzle already migrated is stamped at this revision
instead of running it (see engine/migrate.py). A fresh database runs it.

Revision ID: 0001_baseline
"""
from alembic import op

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

STATEMENTS = [
    'CREATE TABLE "announcement" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"body_md" text NOT NULL,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL\n)',
    'CREATE TABLE "audit_log" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"actor_id" text,\n\t"action" text NOT NULL,\n\t"target" text,\n\t"reason" text NOT NULL,\n\t"detail" jsonb,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL\n)',
    'CREATE TABLE "bid" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"lot_id" bigint NOT NULL,\n\t"participant_id" text NOT NULL,\n\t"amount" integer NOT NULL,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL\n)',
    'CREATE TABLE "contest" (\n\t"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,\n\t"phase" text DEFAULT \'registration\' NOT NULL,\n\t"phase_ends_at" timestamp with time zone,\n\t"registration_open" boolean DEFAULT true NOT NULL,\n\t"starting_balance" integer DEFAULT 1000 NOT NULL,\n\t"bid_increment" integer DEFAULT 10 NOT NULL,\n\t"countdown_seconds" integer DEFAULT 15 NOT NULL,\n\t"opening_window_seconds" integer DEFAULT 30 NOT NULL,\n\t"ownership_cap" integer,\n\t"coding1_minutes" integer DEFAULT 90 NOT NULL,\n\t"final_minutes" integer DEFAULT 60 NOT NULL,\n\t"p1_puzzles_minutes" integer DEFAULT 45 NOT NULL,\n\t"p1_hacking_minutes" integer DEFAULT 45 NOT NULL,\n\t"p1_selection_basis" text DEFAULT \'\' NOT NULL,\n\t"p1_leaderboard_mode" text DEFAULT \'hidden\' NOT NULL,\n\t"leaderboard_mode" text DEFAULT \'live\' NOT NULL,\n\t"leaderboard_frozen_at" timestamp with time zone,\n\tCONSTRAINT "contest_single_row" CHECK ("contest"."id" = 1)\n)',
    'CREATE TABLE "draft" (\n\t"participant_id" text NOT NULL,\n\t"question_id" text NOT NULL,\n\t"source" text NOT NULL,\n\t"language" text NOT NULL,\n\t"updated_at" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT "draft_participant_id_question_id_pk" PRIMARY KEY("participant_id","question_id")\n)',
    'CREATE TABLE "hint" (\n\t"question_id" text NOT NULL,\n\t"idx" integer NOT NULL,\n\t"price" integer NOT NULL,\n\t"body_md" text NOT NULL,\n\tCONSTRAINT "hint_question_id_idx_pk" PRIMARY KEY("question_id","idx")\n)',
    'CREATE TABLE "hint_purchase" (\n\t"question_id" text NOT NULL,\n\t"hint_idx" integer NOT NULL,\n\t"participant_id" text NOT NULL,\n\t"price_paid" integer NOT NULL,\n\t"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT "hint_purchase_question_id_hint_idx_participant_id_pk" PRIMARY KEY("question_id","hint_idx","participant_id")\n)',
    'CREATE TABLE "judgement" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"submission_id" bigint NOT NULL,\n\t"state" text DEFAULT \'pending\' NOT NULL,\n\t"job_id" text,\n\t"verdict" text,\n\t"passed" integer,\n\t"total" integer,\n\t"first_fail" integer,\n\t"max_time_ms" real,\n\t"max_memory_kb" integer,\n\t"compile_output" text,\n\t"message" text,\n\t"jury_detail" text,\n\t"problem_version" text,\n\t"progress_done" integer DEFAULT 0 NOT NULL,\n\t"progress_total" integer DEFAULT 0 NOT NULL,\n\t"attempt" integer DEFAULT 1 NOT NULL,\n\t"retries" integer DEFAULT 0 NOT NULL,\n\t"cancelled" boolean DEFAULT false NOT NULL,\n\t"superseded_at" timestamp with time zone,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,\n\t"ended_at" timestamp with time zone\n)',
    'CREATE TABLE "ledger" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"participant_id" text NOT NULL,\n\t"delta" integer NOT NULL,\n\t"balance_after" integer NOT NULL,\n\t"reason" text NOT NULL,\n\t"ref" text,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL\n)',
    'CREATE TABLE "lot" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"question_id" text NOT NULL,\n\t"round" integer NOT NULL,\n\t"state" text DEFAULT \'pending\' NOT NULL,\n\t"order" integer NOT NULL,\n\t"opened_at" timestamp with time zone,\n\t"no_bid_deadline" timestamp with time zone,\n\t"bidding_ends_at" timestamp with time zone,\n\t"current_bid" integer,\n\t"current_bidder_id" text,\n\t"closed_at" timestamp with time zone,\n\tCONSTRAINT "lot_question_round" UNIQUE("question_id","round")\n)',
    'CREATE TABLE "notification" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"participant_id" text NOT NULL,\n\t"body_md" text NOT NULL,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,\n\t"read_at" timestamp with time zone\n)',
    'CREATE TABLE "ownership" (\n\t"question_id" text PRIMARY KEY NOT NULL,\n\t"participant_id" text NOT NULL,\n\t"price_paid" integer NOT NULL,\n\t"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,\n\t"voided_at" timestamp with time zone\n)',
    'CREATE TABLE "p1_advancement" (\n\t"participant_id" text PRIMARY KEY NOT NULL,\n\t"advanced" boolean NOT NULL,\n\t"decided_by" text NOT NULL,\n\t"decided_at" timestamp with time zone DEFAULT now() NOT NULL,\n\t"reason" text NOT NULL\n)',
    'CREATE TABLE "p1_answer" (\n\t"participant_id" text NOT NULL,\n\t"question_id" bigint NOT NULL,\n\t"answer" jsonb,\n\t"explanation" text,\n\t"auto_score" integer,\n\t"manual_score" integer,\n\t"explain_score" integer,\n\t"graded_by" text,\n\t"graded_at" timestamp with time zone,\n\t"grade_comment" text,\n\t"score_job_id" text,\n\t"score_state" text,\n\t"score_error" text,\n\t"updated_at" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT "p1_answer_participant_id_question_id_pk" PRIMARY KEY("participant_id","question_id")\n)',
    'CREATE TABLE "p1_hack_attempt" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"participant_id" text NOT NULL,\n\t"question_id" bigint NOT NULL,\n\t"input" text NOT NULL,\n\t"state" text DEFAULT \'pending\' NOT NULL,\n\t"job_id" text,\n\t"valid_input" boolean,\n\t"invalid_reason" text,\n\t"hacked" boolean,\n\t"verdict" text,\n\t"points_awarded" integer DEFAULT 0 NOT NULL,\n\t"retries" integer DEFAULT 0 NOT NULL,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,\n\t"ended_at" timestamp with time zone\n)',
    'CREATE TABLE "p1_hack_question" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"title" text NOT NULL,\n\t"statement_md" text NOT NULL,\n\t"constraints_md" text DEFAULT \'\' NOT NULL,\n\t"problem_id" text NOT NULL,\n\t"given_source" text NOT NULL,\n\t"given_language" text NOT NULL,\n\t"hack_points" integer NOT NULL,\n\t"fail_penalty" integer DEFAULT 0 NOT NULL,\n\t"order_index" integer DEFAULT 0 NOT NULL,\n\t"published" boolean DEFAULT false NOT NULL,\n\t"voided" boolean DEFAULT false NOT NULL,\n\t"ready" boolean DEFAULT false NOT NULL\n)',
    'CREATE TABLE "p1_question" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"title" text NOT NULL,\n\t"body_md" text NOT NULL,\n\t"category" text NOT NULL,\n\t"kind" text NOT NULL,\n\t"grading" text NOT NULL,\n\t"points" integer NOT NULL,\n\t"explain_points" integer DEFAULT 0 NOT NULL,\n\t"order_index" integer DEFAULT 0 NOT NULL,\n\t"published" boolean DEFAULT false NOT NULL,\n\t"voided" boolean DEFAULT false NOT NULL,\n\t"config" jsonb DEFAULT \'{}\'::jsonb NOT NULL,\n\t"answer_key" jsonb,\n\t"model_answer" text,\n\t"validator_py" text,\n\t"points_per_entry" integer,\n\t"max_entries" integer DEFAULT 100 NOT NULL,\n\t"format_regex" text,\n\t"format_hint" text,\n\t"ready" boolean DEFAULT false NOT NULL\n)',
    'CREATE TABLE "participant" (\n\t"user_id" text PRIMARY KEY NOT NULL,\n\t"balance" integer DEFAULT 0 NOT NULL,\n\t"preferred_language" text,\n\t"registered_at" timestamp with time zone DEFAULT now() NOT NULL,\n\t"last_judgement_ended_at" timestamp with time zone,\n\t"p1_puzzles_finished_at" timestamp with time zone,\n\t"p1_hacking_finished_at" timestamp with time zone,\n\t"disqualified_at" timestamp with time zone,\n\t"disqualified_reason" text,\n\tCONSTRAINT "balance_nonnegative" CHECK ("participant"."balance" >= 0)\n)',
    'CREATE TABLE "question" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"title" text NOT NULL,\n\t"difficulty" text NOT NULL,\n\t"score" integer NOT NULL,\n\t"base_price" integer NOT NULL,\n\t"statement_md" text DEFAULT \'\' NOT NULL,\n\t"sample_count" integer DEFAULT 0 NOT NULL,\n\t"auction_order" integer DEFAULT 0 NOT NULL,\n\t"status" text DEFAULT \'unsold\' NOT NULL,\n\t"problem_version" text,\n\t"validated" boolean DEFAULT false NOT NULL\n)',
    'CREATE TABLE "submission" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"participant_id" text NOT NULL,\n\t"question_id" text NOT NULL,\n\t"language" text NOT NULL,\n\t"source" text NOT NULL,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL\n)',
    'CREATE TABLE "account" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"account_id" text NOT NULL,\n\t"provider_id" text NOT NULL,\n\t"user_id" text NOT NULL,\n\t"access_token" text,\n\t"refresh_token" text,\n\t"id_token" text,\n\t"access_token_expires_at" timestamp,\n\t"refresh_token_expires_at" timestamp,\n\t"scope" text,\n\t"password" text,\n\t"created_at" timestamp DEFAULT now() NOT NULL,\n\t"updated_at" timestamp NOT NULL\n)',
    'CREATE TABLE "session" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"expires_at" timestamp NOT NULL,\n\t"token" text NOT NULL,\n\t"created_at" timestamp DEFAULT now() NOT NULL,\n\t"updated_at" timestamp NOT NULL,\n\t"ip_address" text,\n\t"user_agent" text,\n\t"user_id" text NOT NULL,\n\t"impersonated_by" text,\n\tCONSTRAINT "session_token_unique" UNIQUE("token")\n)',
    'CREATE TABLE "user" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"name" text NOT NULL,\n\t"email" text NOT NULL,\n\t"email_verified" boolean DEFAULT false NOT NULL,\n\t"image" text,\n\t"created_at" timestamp DEFAULT now() NOT NULL,\n\t"updated_at" timestamp DEFAULT now() NOT NULL,\n\t"username" text,\n\t"display_username" text,\n\t"role" text,\n\t"banned" boolean DEFAULT false,\n\t"ban_reason" text,\n\t"ban_expires" timestamp,\n\t"preferred_language" text,\n\tCONSTRAINT "user_email_unique" UNIQUE("email"),\n\tCONSTRAINT "user_username_unique" UNIQUE("username")\n)',
    'CREATE TABLE "verification" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"identifier" text NOT NULL,\n\t"value" text NOT NULL,\n\t"expires_at" timestamp NOT NULL,\n\t"created_at" timestamp DEFAULT now() NOT NULL,\n\t"updated_at" timestamp DEFAULT now() NOT NULL\n)',
    'ALTER TABLE "bid" ADD CONSTRAINT "bid_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "bid" ADD CONSTRAINT "bid_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "draft" ADD CONSTRAINT "draft_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "hint" ADD CONSTRAINT "hint_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action',
    'ALTER TABLE "hint_purchase" ADD CONSTRAINT "hint_purchase_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "judgement" ADD CONSTRAINT "judgement_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "ledger" ADD CONSTRAINT "ledger_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "lot" ADD CONSTRAINT "lot_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "lot" ADD CONSTRAINT "lot_current_bidder_id_participant_user_id_fk" FOREIGN KEY ("current_bidder_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "notification" ADD CONSTRAINT "notification_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "ownership" ADD CONSTRAINT "ownership_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "ownership" ADD CONSTRAINT "ownership_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "p1_advancement" ADD CONSTRAINT "p1_advancement_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "p1_answer" ADD CONSTRAINT "p1_answer_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "p1_answer" ADD CONSTRAINT "p1_answer_question_id_p1_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."p1_question"("id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "p1_hack_attempt" ADD CONSTRAINT "p1_hack_attempt_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "p1_hack_attempt" ADD CONSTRAINT "p1_hack_attempt_question_id_p1_hack_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."p1_hack_question"("id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "participant" ADD CONSTRAINT "participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action',
    'ALTER TABLE "submission" ADD CONSTRAINT "submission_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "submission" ADD CONSTRAINT "submission_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action',
    'ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action',
    'CREATE INDEX "bid_lot_idx" ON "bid" USING btree ("lot_id")',
    'CREATE INDEX "judgement_submission_idx" ON "judgement" USING btree ("submission_id")',
    'CREATE INDEX "judgement_state_idx" ON "judgement" USING btree ("state")',
    'CREATE INDEX "ledger_participant_idx" ON "ledger" USING btree ("participant_id")',
    'CREATE INDEX "notification_participant_idx" ON "notification" USING btree ("participant_id")',
    'CREATE INDEX "hack_attempt_participant_idx" ON "p1_hack_attempt" USING btree ("participant_id","question_id")',
    'CREATE INDEX "submission_participant_question_idx" ON "submission" USING btree ("participant_id","question_id")',
    'CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id")',
    'CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id")',
    'CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier")',
    'ALTER TABLE "p1_hack_question" ADD COLUMN "breaking_input" text',
    'ALTER TABLE "p1_hack_question" ADD COLUMN "verified_elsewhere" boolean DEFAULT false NOT NULL',
    'ALTER TABLE "p1_question" ADD COLUMN "verified_elsewhere" boolean DEFAULT false NOT NULL',
    'ALTER TABLE "p1_answer" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL',
    'ALTER TABLE "contest" ADD COLUMN "auction_paused_at" timestamp with time zone',
    'ALTER TABLE "contest" ADD COLUMN "auction_mode" text DEFAULT \'online\' NOT NULL',
    'CREATE TABLE "blackout" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"participant_id" text NOT NULL,\n\t"by_id" text NOT NULL,\n\t"seconds" integer NOT NULL,\n\t"starts_at" timestamp with time zone NOT NULL,\n\t"ends_at" timestamp with time zone NOT NULL,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL\n)',
    'CREATE TABLE "powerup" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"kind" text NOT NULL,\n\t"name" text NOT NULL,\n\t"description" text DEFAULT \'\' NOT NULL,\n\t"price" integer NOT NULL,\n\t"duration_seconds" integer,\n\t"enabled" boolean DEFAULT true NOT NULL,\n\t"max_held" integer,\n\t"max_purchases" integer,\n\t"usable_phases" jsonb DEFAULT \'[]\'::jsonb NOT NULL,\n\t"sort_order" integer DEFAULT 0 NOT NULL\n)',
    'CREATE TABLE "powerup_event" (\n\t"id" bigserial PRIMARY KEY NOT NULL,\n\t"kind" text NOT NULL,\n\t"powerup_id" bigint,\n\t"actor_id" text NOT NULL,\n\t"target_id" text,\n\t"quantity" integer DEFAULT 1 NOT NULL,\n\t"cost" integer DEFAULT 0 NOT NULL,\n\t"request_id" text,\n\t"detail" jsonb,\n\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT "powerup_event_idempotent" UNIQUE("actor_id","request_id")\n)',
    'CREATE TABLE "powerup_inventory" (\n\t"participant_id" text NOT NULL,\n\t"powerup_id" bigint NOT NULL,\n\t"quantity" integer DEFAULT 0 NOT NULL,\n\t"purchased" integer DEFAULT 0 NOT NULL,\n\tCONSTRAINT "powerup_inventory_participant_id_powerup_id_pk" PRIMARY KEY("participant_id","powerup_id")\n)',
    'ALTER TABLE "contest" ADD COLUMN "marketplace_open" boolean DEFAULT false NOT NULL',
    'ALTER TABLE "blackout" ADD CONSTRAINT "blackout_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action',
    'ALTER TABLE "blackout" ADD CONSTRAINT "blackout_by_id_participant_user_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action',
    'ALTER TABLE "powerup_event" ADD CONSTRAINT "powerup_event_powerup_id_powerup_id_fk" FOREIGN KEY ("powerup_id") REFERENCES "public"."powerup"("id") ON DELETE no action ON UPDATE no action',
    'ALTER TABLE "powerup_event" ADD CONSTRAINT "powerup_event_actor_id_participant_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action',
    'ALTER TABLE "powerup_event" ADD CONSTRAINT "powerup_event_target_id_participant_user_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action',
    'ALTER TABLE "powerup_inventory" ADD CONSTRAINT "powerup_inventory_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE cascade ON UPDATE no action',
    'ALTER TABLE "powerup_inventory" ADD CONSTRAINT "powerup_inventory_powerup_id_powerup_id_fk" FOREIGN KEY ("powerup_id") REFERENCES "public"."powerup"("id") ON DELETE cascade ON UPDATE no action',
    'CREATE INDEX "blackout_participant_idx" ON "blackout" USING btree ("participant_id","ends_at")',
    'CREATE INDEX "powerup_event_actor_idx" ON "powerup_event" USING btree ("actor_id")',
    'CREATE INDEX "powerup_event_target_idx" ON "powerup_event" USING btree ("target_id")',
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    raise NotImplementedError("the baseline is not reversible")
