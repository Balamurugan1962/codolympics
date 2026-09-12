# judge-api: the HTTP service. Runs unprivileged and contains no compilers --
# all untrusted code executes in the separate go-judge container.
FROM python:3.12-slim-bookworm

WORKDIR /srv

# Dependencies first, so editing application code does not re-resolve them.
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
      "fastapi>=0.115" \
      "uvicorn[standard]>=0.32" \
      "pydantic>=2.9" \
      "pydantic-settings>=2.6" \
      "httpx>=0.27"

COPY app ./app
COPY openapi.yaml ./openapi.yaml

# Never run as root: this container is reachable from the backend network.
RUN useradd --system --uid 10001 judge
USER judge

EXPOSE 8000

# One worker process. Judging concurrency is managed by the thread pool inside
# the app (JUDGE_CONCURRENCY), so extra uvicorn workers would multiply the
# configured core limit and make measured times unreliable.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
