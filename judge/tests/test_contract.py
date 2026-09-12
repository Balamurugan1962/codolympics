"""The service must match the published contract (NFR-J-09).

openapi.yaml is the artifact the backend team builds against, so drift between
it and the running service is a real defect, not a documentation nit.
"""
from pathlib import Path

import pytest
import yaml

SPEC_PATH = Path(__file__).resolve().parent.parent / "openapi.yaml"


@pytest.fixture(scope="module")
def spec() -> dict:
    return yaml.safe_load(SPEC_PATH.read_text())


def test_spec_is_valid_openapi(spec):
    from openapi_spec_validator import validate
    validate(spec)


def test_every_documented_route_exists(spec, client):
    from app import main

    implemented = {
        (route.path, method.lower())
        for route in main.app.routes
        for method in getattr(route, "methods", set())
    }
    for path, operations in spec["paths"].items():
        for method in operations:
            assert (path, method) in implemented, f"{method.upper()} {path} is in the spec but not implemented"


def test_no_undocumented_routes(spec, client):
    from app import main

    documented = {
        (path, method)
        for path, operations in spec["paths"].items()
        for method in operations
    }
    builtin = {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}

    for route in main.app.routes:
        path = route.path
        if path in builtin:
            continue
        for method in getattr(route, "methods", set()):
            if method in {"HEAD", "OPTIONS"}:
                continue
            assert (path, method.lower()) in documented, f"{method} {path} is implemented but undocumented"


def test_verdicts_match_the_spec(spec):
    from typing import get_args

    from app.models import Verdict

    assert set(spec["components"]["schemas"]["Verdict"]["enum"]) == set(get_args(Verdict))


def test_compare_modes_match_the_spec(spec):
    from typing import get_args

    from app.models import CompareMode

    documented = spec["components"]["schemas"]["ProblemInfo"]["properties"]["compare"]["enum"]
    assert set(documented) == set(get_args(CompareMode))


def test_error_codes_match_the_spec(spec):
    """Every error the service can raise must be in the spec's enum."""
    from app import errors

    documented = set(spec["components"]["schemas"]["Error"]["properties"]["error"]["enum"])
    raised = {
        errors.invalid_request("x").code,
        errors.unknown_language("x", ["y"]).code,
        errors.source_too_large(1, 2).code,
        errors.input_too_large(1, 2).code,
        errors.unauthorized().code,
        errors.problem_not_found("x").code,
        errors.job_not_found("x").code,
        errors.busy(1, 2).code,
        errors.sandbox_unavailable("x").code,
    }
    assert raised == documented


def test_source_limit_matches_the_spec(spec):
    from app.config import settings

    documented = spec["components"]["schemas"]["SubmitRequest"]["properties"]["source"]["maxLength"]
    assert settings.max_source_bytes == documented


def test_submit_returns_202(spec):
    assert "202" in spec["paths"]["/submit"]["post"]["responses"]
