"""Getting a submission into a runnable form, once.

The compiled artefact is cached inside go-judge and mounted into each run by
fileId, so a 10,000-testcase problem costs one compile, not ten thousand
(US-J1-04). Interpreted languages have no compile step; their artefact is the
source file itself, uploaded once. Either way the artefact is released when
the `with` block ends, whatever happened inside it.
"""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Iterator

from app.core.languages import Language
from app.core.verdict import truncate
from app.sandbox import command
from app.sandbox.client import Sandbox
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


class Compiler:
    def __init__(self, sandbox: Sandbox, compile_output_bytes: int):
        self.sandbox = sandbox
        self.compile_output_bytes = compile_output_bytes

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

    def _upload(self, language: Language, source: str) -> Program:
        file_id = self.sandbox.upload(source)
        return Program({language.source_name: {"fileId": file_id}}, file_ids=[file_id])

    def _compile(self, language: Language, source: str) -> Program:
        result = self.sandbox.run([command.build(
            args=language.compile_args or [],
            env=language.env,
            limits=Limits(language.compile_time_limit_ms, language.compile_memory_mb, self.compile_output_bytes),
            copy_in={language.source_name: {"content": source}},
            cache_outputs=language.artefacts,
        )])[0]
        output = truncate((result.stdout + result.stderr).strip(), self.compile_output_bytes)
        produced = list(result.file_ids.values())

        missing = [name for name in language.artefacts if name not in result.file_ids]
        if not result.accepted or result.exit_status != 0 or missing:
            # Anything produced before the failure is still released.
            return Program({}, output or result.stopped_by("compiler"), produced)
        return Program({name: {"fileId": result.file_ids[name]} for name in language.artefacts}, output, produced)
