-- Phase 2 partial scores for the hall board: one row per participant with points.
--
-- A question is worth floor(score * hidden passed / hidden total) from the participant's best
-- judgement on it (an AC is the full score); the time is when that best was
-- first reached, from the start of the round. Which submissions count follows
-- engine/engine/coding/scoring.py: current judgements only, no void questions,
-- and either a question the participant owns or an unsold one submitted in the
-- common round.
--
-- The contest's own `passed` is the number of tests before the first failure (the
-- judge stops there). board-server.py reruns those submissions over every test and
-- passes the true counts in as -v full='{"<judgement id>": passed, ...}'; one not
-- rerun yet falls back to the contest's count.
-- Run with psql -v frozen='<iso timestamp>' (or '' for none) -v full='<json>'.
with c as (
  select
    final_started_at,
    coalesce(
      coding1_started_at,
      case when phase = 'coding1' and phase_ends_at is not null
           then phase_ends_at - make_interval(mins => coding1_minutes) end
    ) as round_start
  from contest
),
counted as (
  select
    s.participant_id as pid,
    s.question_id as qid,
    s.created_at,
    j.verdict = 'AC' as ac,
    case when j.verdict = 'AC' then q.score
         -- Hidden tests only: the samples are in the statement, so passing them earns nothing.
         else floor(q.score * coalesce((:'full'::jsonb ->> j.id::text)::int,
                                       greatest(0, j.passed - q.sample_count))::numeric
                    / nullif(j.total - q.sample_count, 0))::int end as points,
    case when o.awarded_at is not null then coalesce(c.round_start, o.awarded_at)
         when q.status = 'unsold' and s.created_at >= c.final_started_at then c.final_started_at
    end as started
  from judgement j
  join submission s on s.id = j.submission_id
  join question q on q.id = s.question_id
  left join ownership o
    on o.question_id = s.question_id and o.participant_id = s.participant_id and o.voided_at is null
  cross join c
  where j.superseded_at is null
    and j.state = 'done'
    and not j.cancelled
    and j.verdict not in ('IE', 'CE')
    and q.status <> 'void'
    and (nullif(:'frozen', '') is null or s.created_at < nullif(:'frozen', '')::timestamptz)
),
best as (
  select distinct on (pid, qid)
    pid, qid, ac, points,
    greatest(0, (extract(epoch from created_at - started) * 1000)::bigint) as ms
  from counted
  where started is not null and points > 0
  order by pid, qid, points desc, created_at
)
select coalesce(json_agg(t), '[]') from (
  select pid, sum(points)::int as score, count(*) filter (where ac)::int as solved, max(ms) as finish_ms
  from best
  group by pid
) t;
