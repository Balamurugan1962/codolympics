"""The FastAPI app: services built at startup, routers mounted, errors shaped."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app import container
from app.api import judging, metadata
from app.api.errors import ApiError
from app.api.schemas import ErrorBody
from app.config import Settings
from app.sandbox.client import Sandbox

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("judge")


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    """Raising ApiError anywhere in a route produces the right JSON body and
    status, so no handler builds error responses by hand."""
    return JSONResponse(
        status_code=exc.status,
        content=ErrorBody(error=exc.code, message=exc.message).model_dump(),
        headers=exc.headers,
    )


def create_app(settings: Settings | None = None, sandbox: Sandbox | None = None) -> FastAPI:
    """The app, wired at startup. Tests pass their own settings and a fake
    sandbox; the service reads its settings from the environment."""
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        services = container.build(settings, sandbox)
        app.state.services = services
        if not settings.service_token:
            log.warning(
                "JUDGE_SERVICE_TOKEN is not set; every authenticated request will be "
                "rejected. Set it to the shared secret the backend uses."
            )
        log.info(
            "judge ready: concurrency=%d queue_limit=%d hack_concurrency=%d problems_dir=%s",
            services.queue.concurrency, services.queue.queue_limit, services.queue.hack_concurrency, settings.problems_dir,
        )
        yield
        services.close()

    app = FastAPI(
        title="Judge Service API",
        version="1.0.0",
        description="Code judging for the auction-based coding competition.",
        lifespan=lifespan,
    )
    app.add_exception_handler(ApiError, api_error_handler)
    app.include_router(metadata.public)
    app.include_router(metadata.router)
    app.include_router(judging.router)
    return app


app = create_app()
