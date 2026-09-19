"""The FastAPI application.

    uvicorn api.main:app --host 0.0.0.0 --port 8080

Reading a request end to end:

  api/main.py              the service token check below, then the matching route
  api/routes/.../x.py      who may call it (api/auth.py) and the body it accepts
  engine/.../y.py          one engine function: the rules, the locks, the writes
  api/error_handlers.py    what an error looks like on the way out
"""

from __future__ import annotations

import hmac
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response

from engine import scheduler
from engine.bootstrap import prepare
from engine.core.config import settings

from . import error_handlers
from .routes import ROUTERS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    prepare()
    stop_scheduler = scheduler.start_in_background(settings.scheduler_interval_s)
    yield
    stop_scheduler.set()


app = FastAPI(
    title="Codolympics contest engine",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

error_handlers.register(app)

for router in ROUTERS:
    app.include_router(router)


@app.middleware("http")
async def only_the_web_app(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Every route except /health requires the service token the web app adds when it forwards."""
    if request.url.path != "/health":
        sent = request.headers.get("x-engine-token", "")
        if not hmac.compare_digest(sent, settings.service_token):
            return error_handlers.error_response(
                403, "forbidden", "requests must come through the web app"
            )
    return await call_next(request)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
