"""Phase 2 submissions: accepting one, the checks in front of it, and cancelling.

A submission is stored before the judge hears about it; `engine.coding.judging`
takes it from there.

One participant, many clicks. `submit` and `cancel_in_flight` lock the participant's
row, so the "nothing already in flight" and cooldown checks see every earlier
submission from that person. Different participants never contend.
"""

from __future__ import annotations

import sqlalchemy as sa

from engine.accounts import wallet
from engine.coding.judging import send_one
from engine.contest.rules import is_phase2, lock_contest
from engine.core import clock, db, errors, events
from engine.judge import client as judge_client
from engine.judge import languages
from engine.marketplace.blackouts import assert_not_blacked_out
from engine.schema import judgement, ownership, participant, submission

COOLDOWN_MS = 3_000
MAX_SOURCE_BYTES = 262_144
IN_FLIGHT = ("pending", "queued", "running")


def submit(participant_id: str, question_id: str, language: str, source: str) -> int:
    offered = offered_languages()
    with db.transaction() as conn:
        c = lock_contest(conn)
        assert_not_blacked_out(conn, participant_id)
        check_round_open(c)
        check_code(language, source, offered)
        p = check_participant(conn, participant_id, question_id)
        if in_flight(conn, participant_id):
            raise errors.conflict("in_flight", "your previous submission is still being judged")
        wait_ms = cooldown_ms(p)
        if wait_ms > 0:
            wait_s = -(-wait_ms // 1000)  # rounded up
            raise errors.conflict("cooldown", f"wait {wait_s} s before submitting again")
        submission_id = conn.execute(
            sa.insert(submission)
            .values(
                participant_id=participant_id,
                question_id=question_id,
                language=language,
                source=source,
            )
            .returning(submission.c.id)
        ).scalar_one()
        conn.execute(sa.insert(judgement).values(submission_id=submission_id, state="pending"))
    # Hand one job to the judge now, so a quiet judge answers at once. Anything else
    # pending -- or this one, if sending fails -- the scheduler sends within a second.
    send_one()
    return submission_id


# The checks in front of putting code on the judge, shared with practice runs.


def offered_languages() -> set[str]:
    """Read before a transaction: it may ask the judge, which must never happen
    while holding locks."""
    return {lang["key"] for lang in languages.offered()}


def check_round_open(c: sa.Row) -> None:
    if not is_phase2(c.phase) or c.phase == "ended":
        raise errors.conflict("not_open", "submissions are not open")
    timed_round = c.phase in ("coding1", "final")
    if timed_round and c.phase_ends_at and c.phase_ends_at <= clock.now():
        raise errors.conflict("round_closed", "this round has closed")


def check_code(language: str, source: str, offered: set[str]) -> None:
    if language not in offered:
        raise errors.invalid(f"language '{language}' is not offered")
    if len(source.encode()) > MAX_SOURCE_BYTES:
        raise errors.invalid("source is larger than 256 KB")


def check_participant(conn: sa.Connection, participant_id: str, question_id: str) -> sa.Row:
    """Lock the participant and confirm they may work on this question.

    The lock serialises this participant's requests: see the module docstring.
    """
    p = wallet.lock_participant(conn, participant_id)
    if p is None:
        raise errors.forbidden("not a participant")
    if p.disqualified_at:
        raise errors.forbidden("your account is disqualified")
    if not owns(conn, participant_id, question_id):
        raise errors.forbidden("you do not own this question")
    return p


def owns(conn: sa.Connection, participant_id: str, question_id: str) -> sa.Row | None:
    return conn.execute(
        sa.select(ownership).where(
            ownership.c.question_id == question_id,
            ownership.c.participant_id == participant_id,
            ownership.c.voided_at.is_(None),
        )
    ).one_or_none()


def in_flight(conn: sa.Connection, participant_id: str) -> list[sa.Row]:
    return conn.execute(
        sa.select(judgement)
        .join(submission, submission.c.id == judgement.c.submission_id)
        .where(
            submission.c.participant_id == participant_id,
            judgement.c.state.in_(IN_FLIGHT),
            judgement.c.superseded_at.is_(None),
        )
    ).all()


def cooldown_ms(p: sa.Row) -> int:
    if not p.last_judgement_ended_at:
        return 0
    return max(0, clock.ms(p.last_judgement_ended_at) + COOLDOWN_MS - clock.now_ms())


def cancel_in_flight(participant_id: str) -> bool:
    """Cancel this participant's judgement in flight. The cooldown starts now."""
    with db.transaction() as conn:
        wallet.lock_participant(conn, participant_id)
        rows = in_flight(conn, participant_id)
        now = clock.now()
        for j in rows:
            conn.execute(
                sa.update(judgement)
                .where(judgement.c.id == j.id)
                .values(
                    state="done",
                    cancelled=True,
                    verdict="IE",
                    message="cancelled",
                    ended_at=now,
                )
            )
        if rows:
            conn.execute(
                sa.update(participant)
                .where(participant.c.user_id == participant_id)
                .values(last_judgement_ended_at=now)
            )
    # After commit: whatever the judge does with the job now, its result can no longer land.
    for j in rows:
        if j.job_id:
            judge_client.cancel(j.job_id)
    if rows:
        events.publish("verdict", {"cancelled": True}, participant_id)
    return bool(rows)
