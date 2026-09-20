"""Each kind of judging as a unit of work the queue can run (see jobs/control.py)."""
from __future__ import annotations

from dataclasses import dataclass

from app.core.results import AnswersResult, HackResult, Judgement
from app.jobs.control import JobControl
from app.judging import answers, hack
from app.judging.answers import AnswerScorer
from app.judging.hack import Hacker
from app.judging.judge import Judge, Submission


@dataclass(frozen=True)
class JudgeTask:
    judge: Judge
    submission: Submission

    @property
    def submission_id(self) -> str | None:
        return self.submission.submission_id

    @property
    def steps(self) -> int:
        return self.submission.problem.total

    def run(self, control: JobControl) -> Judgement:
        return self.judge.run(self.submission, control)

    def failed(self, message: str) -> Judgement:
        return self.submission.internal_error(message)

    def cancelled(self) -> Judgement:
        return self.submission.judgement("IE", "cancelled", passed=0, jury_detail="cancelled")


@dataclass(frozen=True)
class HackTask:
    hacker: Hacker
    submission: Submission
    input_text: str

    @property
    def submission_id(self) -> str | None:
        return self.submission.submission_id

    @property
    def steps(self) -> int:
        return 3        # validate, reference, given

    def run(self, control: JobControl) -> HackResult:
        return self.hacker.run(self.submission, self.input_text)

    def failed(self, message: str) -> HackResult:
        return hack.internal_error(self.submission, message)

    def cancelled(self) -> HackResult:
        return self.failed("cancelled")


@dataclass(frozen=True)
class AnswersTask:
    scorer: AnswerScorer
    validator: str
    entries: list[str]
    submission_id: str | None = None

    @property
    def steps(self) -> int:
        return 1

    def run(self, control: JobControl) -> AnswersResult:
        return self.scorer.score(self.validator, self.entries, self.submission_id)

    def failed(self, message: str) -> AnswersResult:
        return answers.internal_error(self.submission_id, message)

    def cancelled(self) -> AnswersResult:
        return self.failed("cancelled")
