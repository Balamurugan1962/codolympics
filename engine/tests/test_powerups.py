"""The marketplace, against a real Postgres. The interesting cases are the concurrent ones."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
import sqlalchemy as sa
from conftest import add_user, at_once, balance_of, codes, raises_code, rows, scalar, set_contest
from sqlalchemy.dialects.postgresql import insert as pg_insert

from engine.coding import submissions
from engine.core import clock, db
from engine.marketplace import blackouts, breaks, buying, catalogue, shields, storefront, using
from engine.schema import (
    attack_break,
    blackout,
    ledger,
    notification,
    participant,
    powerup,
    powerup_event,
    powerup_inventory,
    shield,
)


def rid() -> str:
    return f"req-{uuid.uuid4().hex}"


@pytest.fixture(autouse=True)
def market() -> dict[str, int]:
    set_contest(phase="coding1", marketplace_open=True)
    for who, name in (("alice", "Alice"), ("bob", "Bob"), ("carol", "Carol")):
        add_user(who, name)
    add_user("admin", "Admin", role="admin")
    catalogue.ensure_powerups()
    with db.transaction() as conn:
        conn.execute(
            sa.update(powerup)
            .where(powerup.c.kind == "blackout")
            .values(duration_seconds=60, price=100, max_held=10)
        )
        conn.execute(
            sa.update(powerup).where(powerup.c.kind == "shield").values(price=100, max_held=10)
        )
        ids = dict(conn.execute(sa.select(powerup.c.kind, powerup.c.id)).all())
    return ids


def give(who: str, powerup_id: int, n: int) -> None:
    with db.transaction() as conn:
        stmt = pg_insert(powerup_inventory).values(
            participant_id=who, powerup_id=powerup_id, quantity=n, purchased=n
        )
        conn.execute(
            stmt.on_conflict_do_update(
                index_elements=["participant_id", "powerup_id"], set_={"quantity": n}
            )
        )


def qty(who: str, powerup_id: int) -> int:
    query = sa.select(powerup_inventory.c.quantity).where(
        powerup_inventory.c.participant_id == who,
        powerup_inventory.c.powerup_id == powerup_id,
    )
    return scalar(query) or 0


def attack(actor: str, target: str, ids: dict[str, int], request_id: str | None = None) -> dict:
    return using.use(actor, ids["blackout"], target, request_id or rid())


def state(who: str) -> dict:
    return blackouts.blackout_for(who)


def shield_of(who: str) -> dict:
    with db.transaction() as conn:
        return shields.shield_state(conn, who)


def run_out(who: str) -> None:
    """The shield that is up ends now, as if its time had passed."""
    with db.transaction() as conn:
        conn.execute(
            sa.update(shield)
            .where(shield.c.participant_id == who, shield.c.absorbed_at.is_(None))
            .values(ends_at=clock.now() - timedelta(seconds=1))
        )


def last_notice(who: str) -> str:
    query = (
        sa.select(notification.c.body_md)
        .where(notification.c.participant_id == who)
        .order_by(notification.c.id.desc())
        .limit(1)
    )
    return scalar(query) or ""


# --- buying ------------------------------------------------------------------


def test_buying_debits_the_balance_and_writes_a_ledger_line(market: dict[str, int]) -> None:
    result = buying.buy("alice", market["blackout"], rid())
    assert (result["balance"], result["owned"]) == (900, 1)
    entry = rows(sa.select(ledger).where(ledger.c.participant_id == "alice"))[0]
    assert (entry.delta, entry.balance_after, entry.reason) == (-100, 900, "powerup")


def test_buying_without_the_money_is_refused(market: dict[str, int]) -> None:
    with db.transaction() as conn:
        conn.execute(
            sa.update(participant).where(participant.c.user_id == "alice").values(balance=50)
        )
    raises_code("insufficient_balance", lambda: buying.buy("alice", market["blackout"], rid()))
    assert balance_of("alice") == 50


def test_buying_while_the_marketplace_is_closed_is_refused(market: dict[str, int]) -> None:
    set_contest(marketplace_open=False)
    raises_code("marketplace_closed", lambda: buying.buy("alice", market["blackout"], rid()))


def test_hold_and_lifetime_limits(market: dict[str, int]) -> None:
    catalogue.save("admin", market["blackout"], {"max_held": 2, "max_purchases": 3}, "caps")
    for _ in range(2):
        buying.buy("alice", market["blackout"], rid())
    raises_code("hold_limit", lambda: buying.buy("alice", market["blackout"], rid()))
    attack("alice", "bob", market)
    buying.buy("alice", market["blackout"], rid())
    attack("alice", "carol", market)
    raises_code("purchase_limit", lambda: buying.buy("alice", market["blackout"], rid()))


def test_a_repeated_request_id_charges_once(market: dict[str, int]) -> None:
    request_id = rid()
    first = buying.buy("alice", market["blackout"], request_id)
    again = buying.buy("alice", market["blackout"], request_id)
    assert (first["replayed"], again["replayed"], again["balance"]) == (False, True, 900)
    assert balance_of("alice") == 900 and qty("alice", market["blackout"]) == 1


def test_the_same_request_sent_at_once_charges_once(market: dict[str, int]) -> None:
    request_id = rid()
    calls = [lambda: buying.buy("alice", market["blackout"], request_id) for _ in range(6)]
    results = at_once(calls)
    assert sum(1 for r in results if isinstance(r, dict) and not r["replayed"]) == 1
    assert balance_of("alice") == 900


def test_purchases_cannot_race_past_the_balance(market: dict[str, int]) -> None:
    with db.transaction() as conn:
        conn.execute(
            sa.update(participant).where(participant.c.user_id == "alice").values(balance=250)
        )
    results = at_once([lambda: buying.buy("alice", market["blackout"], rid()) for _ in range(6)])
    assert sum(isinstance(r, dict) for r in results) == 2
    assert balance_of("alice") == 50 and qty("alice", market["blackout"]) == 2


# --- blackout -----------------------------------------------------------------


def test_a_blackout_lands_names_the_attacker_and_locks_the_target_out(
    market: dict[str, int],
) -> None:
    give("alice", market["blackout"], 1)
    assert attack("alice", "bob", market)["outcome"] == "blackout"
    s = state("bob")
    assert (s["active"], s["count"], s["by"]) == (True, 1, ["Alice"])
    raises_code("blacked_out", lambda: submissions.submit("bob", "nope", "python", "x"))
    assert not state("alice")["active"]


def test_blackouts_arriving_together_stack_end_to_end(market: dict[str, int]) -> None:
    give("alice", market["blackout"], 1)
    give("carol", market["blackout"], 1)
    started = clock.now_ms()
    at_once([lambda: attack("alice", "bob", market), lambda: attack("carol", "bob", market)])
    s = state("bob")
    total_ms = clock.ms(datetime.fromisoformat(s["ends_at"])) - started
    assert s["count"] == 2 and 118_000 < total_ms < 123_000


def test_two_people_attacking_each_other_at_once_do_not_deadlock(market: dict[str, int]) -> None:
    give("alice", market["blackout"], 5)
    give("bob", market["blackout"], 5)
    calls = [lambda: attack("alice", "bob", market), lambda: attack("bob", "alice", market)] * 5
    results = at_once(calls)
    assert all(isinstance(r, dict) for r in results), results


def test_invalid_attacks_spend_nothing(market: dict[str, int]) -> None:
    give("alice", market["blackout"], 1)
    raises_code("invalid_request", lambda: attack("alice", "alice", market))
    with db.transaction() as conn:
        conn.execute(
            sa.update(participant)
            .where(participant.c.user_id == "bob")
            .values(disqualified_at=clock.now())
        )
    raises_code("target_inactive", lambda: attack("alice", "bob", market))
    raises_code("not_owned", lambda: using.use("carol", market["blackout"], "alice", rid()))
    set_contest(phase="auction1")
    raises_code("wrong_phase", lambda: attack("alice", "carol", market))
    assert qty("alice", market["blackout"]) == 1


def test_a_repeated_attack_request_lands_once(market: dict[str, int]) -> None:
    give("alice", market["blackout"], 2)
    request_id = rid()
    attack("alice", "bob", market, request_id)
    assert attack("alice", "bob", market, request_id)["replayed"] is True
    assert qty("alice", market["blackout"]) == 1 and state("bob")["count"] == 1


def test_a_blackout_expires_with_nothing_running_and_ends_with_the_contest(
    market: dict[str, int],
) -> None:
    give("alice", market["blackout"], 2)
    attack("alice", "bob", market)
    with db.transaction() as conn:
        conn.execute(sa.update(blackout).values(ends_at=clock.now() - timedelta(seconds=1)))
    assert not state("bob")["active"]
    attack("alice", "bob", market)
    set_contest(phase="ended")
    assert not state("bob")["active"]


# --- shield ---------------------------------------------------------------------


def test_a_shield_absorbs_one_attack(market: dict[str, int]) -> None:
    give("alice", market["blackout"], 1)
    give("bob", market["shield"], 1)
    assert attack("alice", "bob", market)["outcome"] == "shielded"
    assert qty("bob", market["shield"]) == 0 and qty("alice", market["blackout"]) == 0
    assert not state("bob")["active"]


def test_one_shield_is_eaten_by_exactly_one_of_two_simultaneous_attacks(
    market: dict[str, int],
) -> None:
    give("alice", market["blackout"], 1)
    give("carol", market["blackout"], 1)
    give("bob", market["shield"], 1)
    calls = [lambda: attack("alice", "bob", market), lambda: attack("carol", "bob", market)]
    results = at_once(calls)
    assert sorted(r["outcome"] for r in results) == ["blackout", "shielded"]
    assert qty("bob", market["shield"]) == 0 and state("bob")["count"] == 1


def test_shields_never_go_negative_under_a_burst(market: dict[str, int]) -> None:
    give("alice", market["blackout"], 5)
    give("bob", market["shield"], 2)
    results = at_once([lambda: attack("alice", "bob", market) for _ in range(5)])
    assert sorted(r["outcome"] for r in results) == ["blackout"] * 3 + ["shielded"] * 2
    assert qty("bob", market["shield"]) == 0 and state("bob")["count"] == 3


def test_a_shield_cannot_be_activated(market: dict[str, int]) -> None:
    give("alice", market["shield"], 1)
    raises_code("passive", lambda: using.use("alice", market["shield"], "bob", rid()))
    assert qty("alice", market["shield"]) == 1


def test_a_bought_shield_starts_at_once_and_the_next_waits(market: dict[str, int]) -> None:
    buying.buy("alice", market["shield"], rid())
    first = shield_of("alice")
    assert (first["active"], first["queued"]) == (True, 0)
    ends = datetime.fromisoformat(first["ends_at"])
    assert timedelta(seconds=295) < ends - clock.now() <= timedelta(seconds=300)
    buying.buy("alice", market["shield"], rid())
    second = shield_of("alice")
    assert (second["active"], second["queued"], second["ends_at"]) == (True, 1, first["ends_at"])


def test_the_next_shield_starts_when_the_one_up_runs_out(market: dict[str, int]) -> None:
    give("bob", market["shield"], 2)
    shields.tick()
    assert (shield_of("bob")["active"], qty("bob", market["shield"])) == (True, 1)
    run_out("bob")
    assert shield_of("bob")["active"] is False
    shields.tick()
    assert (shield_of("bob")["active"], qty("bob", market["shield"])) == (True, 0)
    run_out("bob")
    shields.tick()
    assert (shield_of("bob")["active"], shield_of("bob")["queued"]) == (False, 0)


def test_absorbing_an_attack_puts_the_next_shield_up_at_once(market: dict[str, int]) -> None:
    give("alice", market["blackout"], 3)
    give("bob", market["shield"], 2)
    assert attack("alice", "bob", market)["outcome"] == "shielded"
    assert (shield_of("bob")["active"], shield_of("bob")["queued"]) == (True, 0)
    assert "next one is up now" in last_notice("bob")
    assert attack("alice", "bob", market)["outcome"] == "shielded"
    assert "your last one" in last_notice("bob")
    assert attack("alice", "bob", market)["outcome"] == "blackout"
    absorbed = rows(sa.select(shield).where(shield.c.absorbed_by == "alice"))
    assert len(absorbed) == 2


def test_a_shield_without_a_time_limit_stays_up_until_it_absorbs_one(
    market: dict[str, int],
) -> None:
    catalogue.save("admin", market["shield"], {"duration_seconds": -1}, "no limit")
    raises_code(
        "invalid_request",
        lambda: catalogue.save("admin", market["shield"], {"duration_seconds": 0}, "break"),
    )
    give("alice", market["blackout"], 2)
    give("bob", market["shield"], 1)
    shields.tick()
    assert (shield_of("bob")["active"], shield_of("bob")["ends_at"]) == (True, None)
    shields.tick()  # nothing to advance: it does not run out
    assert (shield_of("bob")["active"], qty("bob", market["shield"])) == (True, 0)
    assert attack("alice", "bob", market)["outcome"] == "shielded"
    assert shield_of("bob")["active"] is False
    assert attack("alice", "bob", market)["outcome"] == "blackout"


def test_organisers_decide_what_an_attack_reveals(market: dict[str, int]) -> None:
    set_contest(phase="coding1", marketplace_open=True, reveal_attacker=False, reveal_shields=False)
    give("alice", market["blackout"], 2)
    give("bob", market["shield"], 1)
    shields.tick()
    view = storefront.marketplace_for("alice")
    targets = {t["id"]: t for t in view["targets"]}
    assert not targets["bob"]["shielded"] and view["reveal_shields"] is False
    attack("alice", "bob", market)
    assert last_notice("bob").startswith("**Someone** tried")
    attack("alice", "bob", market)
    assert last_notice("bob").startswith("**Someone** blacked")
    assert state("bob")["by"] == ["someone"]


# --- the cap on being attacked ----------------------------------------------------


def break_of(who: str) -> dict:
    with db.transaction() as conn:
        return breaks.break_state(conn, who)


def end_break(who: str) -> None:
    """Every timed break this person has is over now. One with no end has none to reach."""
    with db.transaction() as conn:
        conn.execute(
            sa.update(attack_break)
            .where(attack_break.c.participant_id == who, attack_break.c.ends_at.is_not(None))
            .values(ends_at=clock.now() - timedelta(seconds=1))
        )


def test_the_cap_starts_a_break_and_the_next_attack_is_refused_unspent(
    market: dict[str, int],
) -> None:
    set_contest(attack_cap=2, attack_break_seconds=120)
    give("alice", market["blackout"], 3)
    assert attack("alice", "bob", market)["outcome"] == "blackout"
    assert not break_of("bob")["active"]
    assert attack("alice", "bob", market)["outcome"] == "blackout"
    b = break_of("bob")
    assert (b["active"], b["number"]) == (True, 1)
    assert "attacked 2 times" in last_notice("bob") and "120 seconds" in last_notice("bob")
    raises_code("target_on_break", lambda: attack("alice", "bob", market))
    assert qty("alice", market["blackout"]) == 1
    # Someone else is still fair game.
    assert attack("alice", "carol", market)["outcome"] == "blackout"
    targets = {t["id"]: t for t in storefront.marketplace_for("carol")["targets"]}
    assert targets["bob"]["break_until"] == b["ends_at"] and targets["alice"]["break_until"] is None


def test_n_plus_one_attacks_at_once_land_n_and_refuse_one(market: dict[str, int]) -> None:
    set_contest(attack_cap=2, attack_break_seconds=120)
    add_user("dave", "Dave")
    attackers = ["alice", "carol", "dave"]
    for who in attackers:
        give(who, market["blackout"], 1)
    results = at_once([lambda who=who: attack(who, "bob", market) for who in attackers])
    landed = [r for r in results if isinstance(r, dict)]
    assert len(landed) == 2 and codes(results) == ["target_on_break"]
    assert state("bob")["count"] == 2
    # The refused attacker keeps their Blackout; the two that landed spent theirs.
    assert sorted(qty(who, market["blackout"]) for who in attackers) == [0, 0, 1]


def test_each_break_for_the_same_person_is_twice_as_long(market: dict[str, int]) -> None:
    set_contest(attack_cap=1, attack_break_seconds=60)
    give("alice", market["blackout"], 3)
    attack("alice", "bob", market)
    first = rows(sa.select(attack_break))[0]
    assert (first.number, first.seconds) == (1, 60)
    end_break("bob")
    attack("alice", "bob", market)
    second = rows(sa.select(attack_break).order_by(attack_break.c.number.desc()))[0]
    assert (second.number, second.seconds) == (2, 120)
    assert break_of("bob")["number"] == 2
    end_break("bob")
    attack("alice", "bob", market)
    assert rows(sa.select(attack_break).order_by(attack_break.c.number.desc()))[0].seconds == 240


def test_the_cap_can_be_the_end_of_it(market: dict[str, int]) -> None:
    set_contest(attack_cap=1, after_cap="forever")
    give("alice", market["blackout"], 2)
    attack("alice", "bob", market)
    b = break_of("bob")
    assert (b["active"], b["ends_at"], b["number"]) == (True, None, 1)
    assert "rest of the contest" in last_notice("bob")
    end_break("bob")  # a timed break would be over; this one has no end to reach
    raises_code("target_on_break", lambda: attack("alice", "bob", market))
    assert qty("alice", market["blackout"]) == 1
    targets = {t["id"]: t for t in storefront.marketplace_for("carol")["targets"]}
    assert (targets["bob"]["off_limits"], targets["bob"]["break_until"]) == (True, None)


def test_whether_an_absorbed_attack_counts_is_a_setting(market: dict[str, int]) -> None:
    set_contest(attack_cap=1, attack_break_seconds=60, count_absorbed_attacks=False)
    give("alice", market["blackout"], 2)
    give("bob", market["shield"], 1)
    assert attack("alice", "bob", market)["outcome"] == "shielded"
    assert not break_of("bob")["active"]
    assert attack("alice", "bob", market)["outcome"] == "blackout"
    assert break_of("bob")["active"]
    set_contest(count_absorbed_attacks=True)
    give("alice", market["blackout"], 1)
    give("carol", market["shield"], 1)
    assert attack("alice", "carol", market)["outcome"] == "shielded"
    assert break_of("carol")["active"]


# --- configuration and the participant's view -------------------------------------


def test_a_setting_change_never_changes_a_running_blackout(market: dict[str, int]) -> None:
    give("alice", market["blackout"], 2)
    attack("alice", "bob", market)
    before = state("bob")["ends_at"]
    catalogue.save("admin", market["blackout"], {"duration_seconds": 600}, "longer")
    assert state("bob")["ends_at"] == before
    raises_code(
        "invalid_request",
        lambda: catalogue.save("admin", market["blackout"], {"duration_seconds": None}, "break"),
    )


def test_the_marketplace_explains_itself_and_never_offers_yourself(market: dict[str, int]) -> None:
    give("bob", market["shield"], 1)
    shields.tick()
    with db.transaction() as conn:
        conn.execute(
            sa.update(participant).where(participant.c.user_id == "alice").values(balance=50)
        )
    view = storefront.marketplace_for("alice")
    offer = next(i for i in view["items"] if i["kind"] == "blackout")
    assert "You have 50" in offer["buy_blocked"] and offer["use_blocked"] == "You do not own one."
    targets = {t["id"]: t for t in view["targets"]}
    assert (
        set(targets) == {"bob", "carol"}
        and targets["bob"]["shielded"]
        and not targets["carol"]["shielded"]
    )


def test_every_purchase_and_attack_is_recorded(market: dict[str, int]) -> None:
    buying.buy("alice", market["blackout"], rid())
    attack("alice", "bob", market)
    events = rows(sa.select(powerup_event).order_by(powerup_event.c.id))
    assert [e.kind for e in events] == ["purchase", "use"] and events[1].target_id == "bob"


def test_the_organiser_sees_what_they_bought_and_used_and_what_landed_on_them(
    market: dict[str, int],
) -> None:
    from engine.admin import dossier

    buying.buy("alice", market["blackout"], rid())
    buying.buy("bob", market["shield"], rid())
    assert attack("alice", "bob", market)["outcome"] == "shielded"

    alice = dossier.powerups("alice")
    kinds = [(e["kind"], e["actor"], e["target"], e["mine"]) for e in alice["events"]]
    assert kinds == [("blocked", "Alice", "Bob", True), ("purchase", "Alice", None, True)]
    assert alice["events"][1]["cost"] == 100 and alice["events"][1]["powerup"] == "Blackout"
    assert all(e["at"] for e in alice["events"])
    assert [(h["name"], h["quantity"], h["purchased"]) for h in alice["holdings"]] == [
        ("Blackout", 0, 1)
    ]

    bob = dossier.powerups("bob")
    assert [(e["kind"], e["mine"]) for e in bob["events"]] == [
        ("blocked", False),
        ("purchase", True),
    ]
    assert len(bob["shields"]) == 1
    assert bob["shields"][0]["absorbed_by"] == "Alice" and not bob["shields"][0]["up"]

    raises_code("not_found", lambda: dossier.powerups("nobody"))
