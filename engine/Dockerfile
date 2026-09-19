# The contest engine: every rule of the contest, behind a thin FastAPI layer.
# It publishes no port. Only the web app reaches it, on the internal network.
FROM python:3.12-slim-bookworm

WORKDIR /srv

# Dependencies first, so editing application code does not re-resolve them.
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
      "fastapi>=0.115" "uvicorn[standard]>=0.32" "pydantic>=2.9" "sqlalchemy>=2.0.36" \
      "psycopg[binary]>=3.2" "alembic>=1.14" "httpx>=0.27" "python-multipart>=0.0.18"

COPY alembic.ini ./
COPY migrations ./migrations
COPY engine ./engine
COPY api ./api

# Never run as root; the problems volume is the only thing this container writes.
RUN useradd --system --uid 10003 engine && mkdir -p /problems && chown engine /problems
USER engine

EXPOSE 8080

# Migrations are idempotent and run on every start. Two workers: the scheduler
# inside each takes a Postgres advisory lock per tick, so only one ever ticks.
CMD ["sh", "-c", "python -m engine.migrate && uvicorn api.main:app --host 0.0.0.0 --port 8080 --workers 2"]
