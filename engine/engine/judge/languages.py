"""The judge's language list, cached for a minute so every submit does not ask the judge.

The cache is per process and only ever holds a copy of the judge's answer, so
two processes disagreeing for a few seconds changes nothing that matters.
"""

from __future__ import annotations

import threading
import time

from engine.judge import client as judge_client
from engine.judge.client import JudgeError

_TTL_S = 60.0

_lock = threading.Lock()
_cached: list[dict] = []
_fetched_at = 0.0


def offered() -> list[dict]:
    global _cached, _fetched_at
    with _lock:
        if _cached and time.monotonic() - _fetched_at < _TTL_S:
            return _cached
    try:
        fresh = judge_client.languages()
    except JudgeError:
        return _cached  # the judge is down: the last known list is better than none
    with _lock:
        _cached = fresh
        _fetched_at = time.monotonic()
    return fresh
