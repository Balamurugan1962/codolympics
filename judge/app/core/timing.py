"""How long something took, in the milliseconds every result reports."""
from __future__ import annotations

import time


class Stopwatch:
    def __init__(self) -> None:
        self.started = time.monotonic()

    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self.started) * 1000)
