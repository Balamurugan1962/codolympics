"""The five tiers, easiest first."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from api.routes.admin.questions import QuestionBody
from engine.schema import DIFFICULTIES


def _body(tier: str) -> QuestionBody:
    return QuestionBody(
        id="p",
        title="t",
        difficulty=tier,
        score=1,
        base_price=1,
        statement_md="s",
        sample_count=0,
        auction_order=1,
        hints=[],
        reason="testing the tiers",
    )


def test_there_are_five_tiers_and_beginner_is_the_lowest() -> None:
    assert DIFFICULTIES == ("beginner", "easy", "easy_medium", "medium", "hard")
    assert _body("beginner").difficulty == "beginner"
    assert _body("easy_medium").difficulty == "easy_medium"
    with pytest.raises(ValidationError):
        _body("trivial")
