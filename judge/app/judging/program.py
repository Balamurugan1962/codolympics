"""Getting a submission into a runnable form, once.

The compiled artefact is cached inside go-judge and mounted into each run by
fileId, so a 10,000-testcase problem costs one compile, not ten thousand
(US-J1-04). Interpreted languages have no compile step; their artefact is the
source file itself, uploaded once. Either way the artefact is released when
the `with` block ends, whatever happened inside it.

The one exception is `prepare_kept`, used for hack attempts. A hack question has
one flawed program, and every attempt against it runs that same source, so
compiling it again for each attempt is the whole cost of a C++ hack (about four
seconds of CPU, against a run of a few milliseconds). Its compiled artefact is
kept between attempts instead, and released when it is pushed out by newer ones.
"""
from __future__ import annotations

import hashlib
import threading
from collections import OrderedDict
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Iterator

from app.core.languages import Language
from app.core.verdict import truncate
from app.sandbox import command
from app.sandbox.client import CompilerOverloaded, Sandbox
from app.sandbox.command import Limits


@dataclass(frozen=True)
class Program:
    """A submission ready to run. `copy_in` is empty when it did not compile."""

    copy_in: dict[str, dict]            # mounted into every run
    compile_output: str = ""
    file_ids: list[str] = field(default_factory=list)   # released afterwards

    @property
    def ok(self) -> bool:
        return bool(self.copy_in)


# A compile is limited by the CPU it uses, which is what says a program is too
# heavy to build. Its wall-clock allowance is a multiple of that, because a
# compile on a busy machine can take several times longer than it computes: with
# seven compiling at once, each was measured at about 15 times its CPU time.
COMPILE_WALL_FACTOR = 8
# One retry when the compiler was starved rather than heavy, before giving up.
COMPILE_ATTEMPTS = 2

# How many compiled programs are kept for hack attempts. A contest has a handful
# of hack questions in a few languages, so this is generous; each entry is one
# small binary held inside go-judge.
KEEP_LIMIT = 64


@dataclass
class _Kept:
    """A compiled program held for reuse, and how many runs are using it now."""

    program: Program
    users: int = 0
    evicted: bool = False   # out of the cache: released when the last run finishes


class Compiler:
    def __init__(self, sandbox: Sandbox, compile_output_bytes: int, keep_limit: int = KEEP_LIMIT):
        self.sandbox = sandbox
        self.compile_output_bytes = compile_output_bytes
        self._keep_limit = keep_limit
        self._kept: OrderedDict[str, _Kept] = OrderedDict()   # least recently used first
        self._kept_lock = threading.Lock()
        self._building: dict[str, threading.Lock] = {}          # one compile per source at a time

    @contextmanager
    def prepare(self, language: Language, source: str) -> Iterator[Program]:
        """Compile, or upload the source for an interpreted language, and
        release whatever the sandbox cached once the caller is done."""
        program = self._compile(language, source) if language.compiled else self._upload(language, source)
        try:
            yield program
        finally:
            # Whatever happened, verdict, exception or cancellation, the
            # sandbox must not keep the artefact (US-J1-04).
            for file_id in program.file_ids:
                self.sandbox.delete(file_id)

    @contextmanager
    def prepare_kept(
        self, language: Language, source: str, *, fresh: bool = False
    ) -> Iterator[tuple[Program, bool]]:
        """Like `prepare`, but a compiled program outlives the `with` block.

        Yields the program and whether it was reused from an earlier attempt.
        Forty people hacking the same solution at once compile it once: the
        others wait for that compile and then run the same artefact. A program
        that failed to compile is never kept, so a fixed problem is not blamed
        for an old error. `fresh` throws away any kept copy first, for when the
        sandbox has lost the artefact (it restarted) and the run says so.
        """
        if not language.compiled:
            with self.prepare(language, source) as program:
                yield program, False
            return
        entry, reused = self._hold(language, source, fresh)
        try:
            yield entry.program, reused
        finally:
            self._let_go(entry)

    def release_all(self) -> None:
        """At shutdown: give back everything still kept."""
        with self._kept_lock:
            gone, self._kept = list(self._kept.values()), OrderedDict()
            for entry in gone:
                entry.evicted = True
        for entry in gone:
            if entry.users == 0:
                self._delete(entry.program)

    def _hold(self, language: Language, source: str, fresh: bool) -> tuple[_Kept, bool]:
        key = hashlib.sha256(f"{language.key}\0{source}".encode()).hexdigest()
        with self._kept_lock:
            building = self._building.setdefault(key, threading.Lock())
        with building:
            stale: _Kept | None = None
            with self._kept_lock:
                entry = self._kept.get(key)
                if entry is not None and fresh:
                    self._evict(key)
                    stale = entry if entry.users == 0 else None    # else its last user releases it
                    entry = None
                if entry is not None:
                    self._kept.move_to_end(key)
                    entry.users += 1
                    return entry, True
            if stale is not None:
                self._delete(stale.program)
            entry = _Kept(self._compile(language, source), users=1)
            if not entry.program.ok:
                entry.evicted = True        # never kept: released as soon as this run ends
                return entry, False
            with self._kept_lock:
                self._kept[key] = entry
                overflow = self._trim()
            for old in overflow:
                self._delete(old.program)
            return entry, False

    def _let_go(self, entry: _Kept) -> None:
        with self._kept_lock:
            entry.users -= 1
            last = entry.evicted and entry.users == 0
        if last:
            self._delete(entry.program)

    def _evict(self, key: str) -> None:
        """Take one entry out of the cache. Its files go when nobody is running on it."""
        entry = self._kept.pop(key)
        entry.evicted = True
        self._building.pop(key, None)

    def _trim(self) -> list[_Kept]:
        """Push out the least recently used entries beyond the limit. Called with the lock held.

        Returns the ones nobody is running on, to be deleted outside the lock; an
        entry still in use is deleted by its last user instead."""
        idle: list[_Kept] = []
        while len(self._kept) > self._keep_limit:
            key = next(iter(self._kept))
            entry = self._kept[key]
            self._evict(key)
            if entry.users == 0:
                idle.append(entry)
        return idle

    def _delete(self, program: Program) -> None:
        for file_id in program.file_ids:
            self.sandbox.delete(file_id)

    def _upload(self, language: Language, source: str) -> Program:
        file_id = self.sandbox.upload(source)
        return Program({language.source_name: {"fileId": file_id}}, file_ids=[file_id])

    def _compile(self, language: Language, source: str) -> Program:
        limits = Limits(
            language.compile_time_limit_ms, language.compile_memory_mb, self.compile_output_bytes,
            clock_ms=language.compile_time_limit_ms * COMPILE_WALL_FACTOR,
        )
        for _ in range(COMPILE_ATTEMPTS):
            result = self.sandbox.run([command.build(
                args=language.compile_args or [],
                env=language.env,
                limits=limits,
                copy_in={language.source_name: {"content": source}},
                cache_outputs=language.artefacts,
            )])[0]
            if not _starved(result, language):
                break
            for file_id in result.file_ids.values():
                self.sandbox.delete(file_id)
        else:
            # Both times it ran out of clock without using its CPU budget: the
            # machine was too busy, not the program too heavy. A compile error
            # would cost the contestant their solution for something that is not
            # theirs, so it is reported as the judge's own failure instead.
            raise CompilerOverloaded(f"the {language.key} compiler was starved of CPU on a busy machine")
        output = truncate((result.stdout + result.stderr).strip(), self.compile_output_bytes)
        produced = list(result.file_ids.values())

        missing = [name for name in language.artefacts if name not in result.file_ids]
        if not result.accepted or result.exit_status != 0 or missing:
            # Anything produced before the failure is still released.
            return Program({}, output or result.stopped_by("compiler"), produced)
        return Program({name: {"fileId": result.file_ids[name]} for name in language.artefacts}, output, produced)


def _starved(result, language: Language) -> bool:
    """Stopped by the clock while using less CPU than it was allowed: load, not the program."""
    return result.status == "Time Limit Exceeded" and result.time_ms < language.compile_time_limit_ms
