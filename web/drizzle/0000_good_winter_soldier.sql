CREATE TABLE "announcement" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"body_md" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target" text,
	"reason" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lot_id" bigint NOT NULL,
	"participant_id" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"phase" text DEFAULT 'registration' NOT NULL,
	"phase_ends_at" timestamp with time zone,
	"registration_open" boolean DEFAULT true NOT NULL,
	"starting_balance" integer DEFAULT 1000 NOT NULL,
	"bid_increment" integer DEFAULT 10 NOT NULL,
	"countdown_seconds" integer DEFAULT 15 NOT NULL,
	"opening_window_seconds" integer DEFAULT 30 NOT NULL,
	"ownership_cap" integer,
	"coding1_minutes" integer DEFAULT 90 NOT NULL,
	"final_minutes" integer DEFAULT 60 NOT NULL,
	"p1_puzzles_minutes" integer DEFAULT 45 NOT NULL,
	"p1_hacking_minutes" integer DEFAULT 45 NOT NULL,
	"p1_selection_basis" text DEFAULT '' NOT NULL,
	"p1_leaderboard_mode" text DEFAULT 'hidden' NOT NULL,
	"leaderboard_mode" text DEFAULT 'live' NOT NULL,
	"leaderboard_frozen_at" timestamp with time zone,
	CONSTRAINT "contest_single_row" CHECK ("contest"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "draft" (
	"participant_id" text NOT NULL,
	"question_id" text NOT NULL,
	"source" text NOT NULL,
	"language" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draft_participant_id_question_id_pk" PRIMARY KEY("participant_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "hint" (
	"question_id" text NOT NULL,
	"idx" integer NOT NULL,
	"price" integer NOT NULL,
	"body_md" text NOT NULL,
	CONSTRAINT "hint_question_id_idx_pk" PRIMARY KEY("question_id","idx")
);
--> statement-breakpoint
CREATE TABLE "hint_purchase" (
	"question_id" text NOT NULL,
	"hint_idx" integer NOT NULL,
	"participant_id" text NOT NULL,
	"price_paid" integer NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hint_purchase_question_id_hint_idx_participant_id_pk" PRIMARY KEY("question_id","hint_idx","participant_id")
);
--> statement-breakpoint
CREATE TABLE "judgement" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"submission_id" bigint NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"job_id" text,
	"verdict" text,
	"passed" integer,
	"total" integer,
	"first_fail" integer,
	"max_time_ms" real,
	"max_memory_kb" integer,
	"compile_output" text,
	"message" text,
	"jury_detail" text,
	"problem_version" text,
	"progress_done" integer DEFAULT 0 NOT NULL,
	"progress_total" integer DEFAULT 0 NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text NOT NULL,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lot" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"round" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"order" integer NOT NULL,
	"opened_at" timestamp with time zone,
	"no_bid_deadline" timestamp with time zone,
	"bidding_ends_at" timestamp with time zone,
	"current_bid" integer,
	"current_bidder_id" text,
	"closed_at" timestamp with time zone,
	CONSTRAINT "lot_question_round" UNIQUE("question_id","round")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"body_md" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ownership" (
	"question_id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"price_paid" integer NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "p1_advancement" (
	"participant_id" text PRIMARY KEY NOT NULL,
	"advanced" boolean NOT NULL,
	"decided_by" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p1_answer" (
	"participant_id" text NOT NULL,
	"question_id" bigint NOT NULL,
	"answer" jsonb,
	"explanation" text,
	"auto_score" integer,
	"manual_score" integer,
	"explain_score" integer,
	"graded_by" text,
	"graded_at" timestamp with time zone,
	"grade_comment" text,
	"score_job_id" text,
	"score_state" text,
	"score_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "p1_answer_participant_id_question_id_pk" PRIMARY KEY("participant_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "p1_hack_attempt" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"question_id" bigint NOT NULL,
	"input" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"job_id" text,
	"valid_input" boolean,
	"invalid_reason" text,
	"hacked" boolean,
	"verdict" text,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "p1_hack_question" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"statement_md" text NOT NULL,
	"constraints_md" text DEFAULT '' NOT NULL,
	"problem_id" text NOT NULL,
	"given_source" text NOT NULL,
	"given_language" text NOT NULL,
	"hack_points" integer NOT NULL,
	"fail_penalty" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"voided" boolean DEFAULT false NOT NULL,
	"ready" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "p1_question" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"category" text NOT NULL,
	"kind" text NOT NULL,
	"grading" text NOT NULL,
	"points" integer NOT NULL,
	"explain_points" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"voided" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"answer_key" jsonb,
	"model_answer" text,
	"validator_py" text,
	"points_per_entry" integer,
	"max_entries" integer DEFAULT 100 NOT NULL,
	"format_regex" text,
	"format_hint" text,
	"ready" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"preferred_language" text,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_judgement_ended_at" timestamp with time zone,
	"p1_puzzles_finished_at" timestamp with time zone,
	"p1_hacking_finished_at" timestamp with time zone,
	"disqualified_at" timestamp with time zone,
	"disqualified_reason" text,
	CONSTRAINT "balance_nonnegative" CHECK ("participant"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"difficulty" text NOT NULL,
	"score" integer NOT NULL,
	"base_price" integer NOT NULL,
	"statement_md" text DEFAULT '' NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"auction_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'unsold' NOT NULL,
	"problem_version" text,
	"validated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"question_id" text NOT NULL,
	"language" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"preferred_language" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bid" ADD CONSTRAINT "bid_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid" ADD CONSTRAINT "bid_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint" ADD CONSTRAINT "hint_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_purchase" ADD CONSTRAINT "hint_purchase_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgement" ADD CONSTRAINT "judgement_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot" ADD CONSTRAINT "lot_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot" ADD CONSTRAINT "lot_current_bidder_id_participant_user_id_fk" FOREIGN KEY ("current_bidder_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership" ADD CONSTRAINT "ownership_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership" ADD CONSTRAINT "ownership_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p1_advancement" ADD CONSTRAINT "p1_advancement_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p1_answer" ADD CONSTRAINT "p1_answer_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p1_answer" ADD CONSTRAINT "p1_answer_question_id_p1_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."p1_question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p1_hack_attempt" ADD CONSTRAINT "p1_hack_attempt_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "p1_hack_attempt" ADD CONSTRAINT "p1_hack_attempt_question_id_p1_hack_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."p1_hack_question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant" ADD CONSTRAINT "participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_participant_id_participant_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participant"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bid_lot_idx" ON "bid" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "judgement_submission_idx" ON "judgement" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "judgement_state_idx" ON "judgement" USING btree ("state");--> statement-breakpoint
CREATE INDEX "ledger_participant_idx" ON "ledger" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "notification_participant_idx" ON "notification" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "hack_attempt_participant_idx" ON "p1_hack_attempt" USING btree ("participant_id","question_id");--> statement-breakpoint
CREATE INDEX "submission_participant_question_idx" ON "submission" USING btree ("participant_id","question_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");