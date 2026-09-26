"""Serve the Phase 2 hall board, with partial scores, without touching the running contest.

    python3 web/scripts/board-server.py          # then open http://<this Mac>:3001/

It serves web/public/board.html and answers GET /api/leaderboard itself:

- It asks the web app's /api/leaderboard first, passing the browser's cookie along
  (cookies are shared across ports on one host, so a browser signed in on :3000 is
  signed in here too). That keeps sign-in, the hidden/frozen setting, disqualified
  people and the Phase 1 tiebreak exactly as the contest has them.
- It then swaps each score for a partial one, floor(score * passed / total) per
  question from board-partial.sql, and re-ranks with the engine's order.

The contest judge stops at a submission's first failing test, so a background thread
reruns every finished non-AC submission over all its tests, one at a time, with
board-fullrun.py inside the judge-api container, and the true counts replace the
contest's. Results are kept in backups/board-fullrun.json, so each submission is
rerun once. The contest's own judgements are never changed.

The partial scores are read with psql inside the postgres container, at most once a
second however many screens are open. Anything else is redirected to the web app.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

PORT = int(os.environ.get("BOARD_PORT", "3001"))
APP = os.environ.get("BOARD_APP", "http://127.0.0.1:3000")
APP_PORT = APP.rsplit(":", 1)[-1]
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PAGE = (HERE.parent / "public" / "board.html").read_bytes()
QUERY = (HERE / "board-partial.sql").read_bytes()
FULLRUN = (HERE / "board-fullrun.py").read_text()
# Hidden tests only (samples skipped), so kept apart from the earlier all-tests file.
RESULTS = ROOT / "backups" / "board-fullrun-hidden.json"
PSQL = ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "contest", "contest", "-At"]
# Finished, current, non-AC judgements whose count stopped at the first failure.
TO_RERUN = """
select coalesce(json_agg(json_build_object('id', j.id, 'problem_id', s.question_id,
  'version', j.problem_version, 'language', s.language, 'source', s.source,
  'skip', q.sample_count) order by j.id), '[]')
from judgement j join submission s on s.id = j.submission_id
join question q on q.id = s.question_id
where j.superseded_at is null and j.state = 'done' and not j.cancelled
  and j.verdict not in ('AC', 'CE', 'IE')
"""

_lock = threading.Lock()
_cache: dict[str, tuple[float, dict[str, dict[str, Any]]]] = {}
_full: dict[str, int] = json.loads(RESULTS.read_text()) if RESULTS.exists() else {}


def psql(*args: str, stdin: bytes | None = None) -> Any:
    out = subprocess.run([*PSQL, *args], input=stdin, capture_output=True, cwd=ROOT, timeout=10, check=True)
    return json.loads(out.stdout)


def partial_scores(frozen_at: str | None) -> dict[str, dict[str, Any]]:
    """Per participant id: partial score, full solves and finish time. Cached for a second."""
    key = frozen_at or ""
    with _lock:
        hit = _cache.get(key)
        if hit and time.monotonic() - hit[0] < 1:
            return hit[1]
        rows = psql("-v", f"frozen={key}", "-v", f"full={json.dumps(_full)}", "-f", "-", stdin=QUERY)
        scores = {r["pid"]: r for r in rows}
        _cache[key] = (time.monotonic(), scores)
        return scores


# The board's countdown can run ahead of the real deadline (to count down to a freeze, say).
TIMER_OFFSET_MIN = int(os.environ.get("BOARD_TIMER_OFFSET_MIN", "0"))
CLOCK = (
    "select json_build_object('phase', phase, 'now', now(), 'ends_at', "
    f"phase_ends_at - make_interval(mins => {TIMER_OFFSET_MIN})) from contest"
)
_clock: tuple[float, Any] = (float("-inf"), None)


def contest_clock() -> Any:
    """The phase, when it ends, and the database's own now (the projector's clock may be off)."""
    global _clock
    if time.monotonic() - _clock[0] >= 1:
        _clock = (time.monotonic(), psql("-c", CLOCK))
    return _clock[1]


def rerun_forever() -> None:
    """Rerun each new non-AC submission over every test, one at a time, and remember it."""
    global _full
    while True:
        try:
            for job in psql("-c", TO_RERUN):
                if str(job["id"]) in _full:
                    continue
                out = subprocess.run(
                    ["docker", "compose", "exec", "-T", "judge-api", "python", "-c", FULLRUN],
                    input=json.dumps(job).encode(), capture_output=True, cwd=ROOT, timeout=600, check=True,
                )
                passed = json.loads(out.stdout.splitlines()[-1])["passed"]
                # A new dict, never an edit: request threads read _full while this runs.
                _full = {**_full, str(job["id"]): passed}
                RESULTS.write_text(json.dumps(_full))
        except (OSError, subprocess.SubprocessError, ValueError, KeyError, IndexError) as e:
            print(f"rerun: {e!r}", flush=True)  # try again on the next pass
        time.sleep(3)


def with_partial(standings: list[dict[str, Any]], scores: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """The engine's rows with partial scores, in the engine's order and tie rules."""
    rows = []
    for r in standings:
        p = scores.get(r["participant_id"], {})
        rows.append({**r, "score": p.get("score", 0), "solved": p.get("solved", 0),
                     "finish_ms": p.get("finish_ms")})
    inf = float("inf")
    rows.sort(key=lambda r: (
        -r["score"],
        r["finish_ms"] if r["finish_ms"] is not None else inf,
        r["phase1_rank"] if r["phase1_rank"] is not None else inf,
        r["name"],
    ))
    tie = ("score", "finish_ms", "phase1_rank")
    for i, r in enumerate(rows):
        prev = rows[i - 1] if i else None
        r["rank"] = prev["rank"] if prev and all(prev[k] == r[k] for k in tie) else i + 1
    return rows


class Board(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in ("/", "/board.html"):
            self._send(200, "text/html; charset=utf-8", PAGE)
        elif path == "/api/leaderboard":
            self._leaderboard()
        else:
            host = (self.headers.get("Host") or "localhost").split(":", 1)[0]
            self.send_response(302)
            self.send_header("Location", f"http://{host}:{APP_PORT}{self.path}")
            self.end_headers()

    def _leaderboard(self) -> None:
        req = urllib.request.Request(f"{APP}/api/leaderboard")
        if cookie := self.headers.get("Cookie"):
            req.add_header("Cookie", cookie)
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                board = json.loads(res.read())
        except urllib.error.HTTPError as e:
            self._send(e.code, "application/json", e.read())
            return
        except OSError:
            self._send(502, "application/json", b'{"error":"app_unreachable"}')
            return
        try:
            # `now` is stamped as the response leaves, not when the cache was filled: a
            # second-old now made the page's countdown jump back and forth.
            board["clock"] = {**contest_clock(), "now": datetime.now(timezone.utc).isoformat()}
        except (OSError, subprocess.SubprocessError, ValueError):
            board["clock"] = None  # the standings still show; only the timer is missing
        if board.get("mode") != "hidden":
            try:
                board["standings"] = with_partial(board["standings"], partial_scores(board.get("frozen_at")))
            except (OSError, subprocess.SubprocessError, ValueError, KeyError):
                # Never fall back to all-or-nothing scores: the page keeps its last good board.
                self._send(502, "application/json", b'{"error":"partial_scores_unavailable"}')
                return
        self._send(200, "application/json", json.dumps(board).encode())

    def _send(self, status: int, kind: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args: object) -> None:
        pass  # one request a second per screen: too noisy to log


if __name__ == "__main__":
    print(f"Phase 2 board on http://0.0.0.0:{PORT}/ (partial scores; standings from {APP})")
    if os.environ.get("BOARD_RERUN", "1") != "0":
        threading.Thread(target=rerun_forever, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", PORT), Board).serve_forever()
