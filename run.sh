#!/usr/bin/env bash
#
# Codolympics — one script to run the whole thing locally.
#
#   ./run.sh up        start Postgres, the sandbox, the judge, the engine and the web app (dev mode)
#   ./run.sh down      stop them (Postgres stays up; `down --all` stops it too)
#   ./run.sh status    what is running, and on which port
#   ./run.sh logs      tail every log
#   ./run.sh reset     wipe the dev database and uploaded problems, re-migrate
#   ./run.sh test      judge tests (real sandbox), engine tests (contest_engine_test), web typecheck
#   ./run.sh smoke     reset, then the 37-step end-to-end test through both phases
#   ./run.sh prod      the whole stack in Docker, from the root docker-compose.yml
#
# First run creates web/.env with generated secrets. Everything it starts is
# recorded under .run/ so `down` can find it again.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$ROOT/.run"; LOGS="$RUN/logs"
WEB="$ROOT/web"; JUDGE="$ROOT/judge"; WORKER="$ROOT/worker"; ENGINE="$ROOT/engine"
GJ_CONTAINER="codolympics-sandbox"
GJ_IMAGE="fyp-judge-worker:1.0"
GJ_PORT=5050
JUDGE_PORT=8001         # 8000 is often taken by something else on a dev machine
ENGINE_PORT=8080
WEB_PORT=3000

mkdir -p "$LOGS"

# --- helpers ----------------------------------------------------------------

say()  { printf '\033[1;32m▸\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }

listening() { lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1 || true; }  # lsof exits 1 when nothing listens; that is not an error here

# Start a daemon detached from this shell: no inherited stdin, stdout or
# stderr, so `./run.sh up | tail` returns instead of waiting on the pipe.
daemon() { # pidfile logfile command...
  local pidfile="$1" logfile="$2"; shift 2
  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" > "$logfile" 2>&1 < /dev/null &
  else
    "$@" > "$logfile" 2>&1 < /dev/null &
  fi
  echo $! > "$pidfile"
}

wait_http() { # url label seconds
  local i=0
  until curl -sf -m 2 -o /dev/null "$1"; do
    i=$((i + 1)); [ "$i" -ge "$3" ] && die "$2 did not come up within $3 s (see $LOGS)"
    sleep 1
  done
}

env_get() { grep -E "^$1=" "$WEB/.env" 2>/dev/null | head -1 | cut -d= -f2-; }

ensure_env() {
  [ -f "$WEB/.env" ] && return
  say "creating web/.env with generated secrets"
  sed -e "s|^BETTER_AUTH_SECRET=$|BETTER_AUTH_SECRET=$(openssl rand -hex 32)|" \
      -e "s|^JUDGE_SERVICE_TOKEN=$|JUDGE_SERVICE_TOKEN=dev-$(openssl rand -hex 12)|" \
      -e "s|^ADMIN_PASSWORD=$|ADMIN_PASSWORD=admin-dev-password|" \
      -e "s|^ENGINE_SERVICE_TOKEN=$|ENGINE_SERVICE_TOKEN=dev-$(openssl rand -hex 12)|" \
      -e "s|^ENGINE_URL=.*|ENGINE_URL=http://127.0.0.1:$ENGINE_PORT|" \
      "$WEB/.env.example" > "$WEB/.env"
  warn "admin password is 'admin-dev-password' — change it in web/.env for anything real"
}

# A web/.env from before the engine existed lacks its settings; add them once.
ensure_engine_env() {
  grep -q "^ENGINE_SERVICE_TOKEN=." "$WEB/.env" || echo "ENGINE_SERVICE_TOKEN=dev-$(openssl rand -hex 12)" >> "$WEB/.env"
  grep -q "^ENGINE_URL=." "$WEB/.env" || echo "ENGINE_URL=http://127.0.0.1:$ENGINE_PORT" >> "$WEB/.env"
  grep -q "^JUDGE_SERVICE_TOKEN=." "$WEB/.env" || echo "JUDGE_SERVICE_TOKEN=dev-$(openssl rand -hex 12)" >> "$WEB/.env"
}

# Everything the engine reads, taken from the same web/.env the web app uses.
engine_env() {
  echo DATABASE_URL="$(env_get DATABASE_URL)" BETTER_AUTH_SECRET="$(env_get BETTER_AUTH_SECRET)" \
    ENGINE_SERVICE_TOKEN="$(env_get ENGINE_SERVICE_TOKEN)" JUDGE_URL="http://127.0.0.1:$JUDGE_PORT" \
    JUDGE_SERVICE_TOKEN="$(env_get JUDGE_SERVICE_TOKEN)" PROBLEMS_DIR="$JUDGE/problems" \
    ADMIN_USERNAME="$(env_get ADMIN_USERNAME)" ADMIN_PASSWORD="$(env_get ADMIN_PASSWORD)"
}

ensure_engine_venv() {
  [ -x "$ENGINE/.venv/bin/uvicorn" ] && return
  say "creating the engine's virtualenv (once)"
  local py; py="$(command -v python3.12 || command -v python3)"
  "$py" -m venv "$ENGINE/.venv" && "$ENGINE/.venv/bin/pip" -q install -e "$ENGINE[dev]" > "$LOGS/engine-install.log" 2>&1 || die "engine install failed, see $LOGS/engine-install.log"
}

migrate() {
  ensure_engine_venv
  ( cd "$ENGINE" && env $(engine_env) .venv/bin/python -m engine.migrate ) > "$LOGS/migrate.log" 2>&1 || die "migrations failed, see $LOGS/migrate.log"
}

# --- pieces -----------------------------------------------------------------

up_postgres() {
  need docker
  if docker compose -f "$WEB/docker-compose.yml" ps --status running postgres 2>/dev/null | grep -q postgres; then
    say "postgres already running"
  else
    say "starting postgres"
    docker compose -f "$WEB/docker-compose.yml" up -d >/dev/null
  fi
  local i=0
  until docker compose -f "$WEB/docker-compose.yml" exec -T postgres pg_isready -U contest >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -ge 30 ] && die "postgres not ready"; sleep 1
  done
}

up_sandbox() {
  if [ -n "$(docker ps -q -f name="^$GJ_CONTAINER$")" ]; then say "sandbox already running"; return; fi
  if ! docker image inspect "$GJ_IMAGE" >/dev/null 2>&1; then
    say "building the sandbox image (once; a few minutes)"
    docker build -t "$GJ_IMAGE" -f "$WORKER/Dockerfile" "$WORKER" > "$LOGS/sandbox-build.log" 2>&1 || die "sandbox build failed, see $LOGS/sandbox-build.log"
  fi
  say "starting sandbox (go-judge) on :$GJ_PORT"
  docker rm -f "$GJ_CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$GJ_CONTAINER" --privileged --cgroupns=host --cpuset-cpus=0-3 \
    -p "$GJ_PORT:5050" "$GJ_IMAGE" >/dev/null
  wait_http "http://localhost:$GJ_PORT/version" "sandbox" 30
}

up_judge() {
  if [ -n "$(listening $JUDGE_PORT)" ]; then say "judge-api already on :$JUDGE_PORT"; return; fi
  need python3
  if [ ! -x "$JUDGE/.venv/bin/uvicorn" ]; then
    say "creating the judge's virtualenv (once)"
    local py; py="$(command -v python3.12 || command -v python3.11 || command -v python3)"
    "$py" -m venv "$JUDGE/.venv" && "$JUDGE/.venv/bin/pip" -q install -e "$JUDGE[dev]" > "$LOGS/judge-install.log" 2>&1 || die "judge install failed, see $LOGS/judge-install.log"
  fi
  mkdir -p "$JUDGE/problems"
  say "starting judge-api on :$JUDGE_PORT"
  ( cd "$JUDGE" && JUDGE_GO_JUDGE_URL="http://localhost:$GJ_PORT" JUDGE_PROBLEMS_DIR="$JUDGE/problems" \
      JUDGE_SERVICE_TOKEN="$(env_get JUDGE_SERVICE_TOKEN)" \
      daemon "$RUN/judge-api.pid" "$LOGS/judge-api.log" .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$JUDGE_PORT" )
  wait_http "http://127.0.0.1:$JUDGE_PORT/health" "judge-api" 30
}

up_engine() {
  if [ -n "$(listening $ENGINE_PORT)" ]; then say "engine already on :$ENGINE_PORT"; return; fi
  say "applying migrations"
  migrate
  say "starting the contest engine on :$ENGINE_PORT"
  ( cd "$ENGINE" && export $(engine_env) && daemon "$RUN/engine.pid" "$LOGS/engine.log" \
      .venv/bin/uvicorn api.main:app --host 127.0.0.1 --port "$ENGINE_PORT" )
  wait_http "http://127.0.0.1:$ENGINE_PORT/health" "engine" 30
}

up_web() {
  if [ -n "$(listening $WEB_PORT)" ]; then say "web already on :$WEB_PORT"; return; fi
  need pnpm
  [ -d "$WEB/node_modules" ] || { say "installing web dependencies (once)"; pnpm --dir "$WEB" install > "$LOGS/web-install.log" 2>&1; }
  say "starting web (dev) on :$WEB_PORT"
  daemon "$RUN/web.pid" "$LOGS/web.log" pnpm --dir "$WEB" dev
  wait_http "http://localhost:$WEB_PORT/login" "web" 90
}

kill_pidfile() {
  [ -f "$RUN/$1.pid" ] || return 0
  local pid; pid="$(cat "$RUN/$1.pid")"
  pkill -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true
  rm -f "$RUN/$1.pid"
}

# --- commands ---------------------------------------------------------------

cmd_up() {
  ensure_env; ensure_engine_env; up_postgres; up_sandbox; up_judge; up_engine; up_web
  echo
  say "Codolympics is up"
  printf '   web       http://localhost:%s   (admin / %s)\n' "$WEB_PORT" "$(env_get ADMIN_PASSWORD)"
  printf '   engine    http://127.0.0.1:%s/health\n' "$ENGINE_PORT"
  printf '   judge     http://127.0.0.1:%s/health\n' "$JUDGE_PORT"
  printf '   sandbox   http://localhost:%s/version\n' "$GJ_PORT"
  printf '   logs      ./run.sh logs\n'
}

cmd_down() {
  say "stopping web, engine and judge-api"
  kill_pidfile web; kill_pidfile engine; kill_pidfile judge-api
  for p in $WEB_PORT $ENGINE_PORT $JUDGE_PORT; do local pid; pid="$(listening $p)"; [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
  say "stopping sandbox"; docker rm -f "$GJ_CONTAINER" >/dev/null 2>&1 || true
  if [ "${1:-}" = "--all" ]; then say "stopping postgres"; docker compose -f "$WEB/docker-compose.yml" down >/dev/null; fi
  say "down"
}

cmd_status() {
  local ok='\033[1;32m●\033[0m' no='\033[1;31m○\033[0m'
  printf "%b postgres   %s\n" "$([ -n "$(listening 5432)" ] && echo "$ok" || echo "$no")" ":5432"
  printf "%b sandbox    %s\n" "$([ -n "$(docker ps -q -f name="^$GJ_CONTAINER$" 2>/dev/null)" ] && echo "$ok" || echo "$no")" ":$GJ_PORT  $GJ_CONTAINER"
  printf "%b judge-api  %s\n" "$([ -n "$(listening $JUDGE_PORT)" ] && echo "$ok" || echo "$no")" ":$JUDGE_PORT  $(curl -sf -m 2 http://127.0.0.1:$JUDGE_PORT/health 2>/dev/null || echo '-')"
  printf "%b engine     %s\n" "$([ -n "$(listening $ENGINE_PORT)" ] && echo "$ok" || echo "$no")" ":$ENGINE_PORT"
  printf "%b web        %s\n" "$([ -n "$(listening $WEB_PORT)" ] && echo "$ok" || echo "$no")" ":$WEB_PORT"
}

cmd_logs() { tail -n 30 -F "$LOGS"/*.log; }

cmd_reset() {
  up_postgres
  say "dropping and recreating the dev database"
  docker compose -f "$WEB/docker-compose.yml" exec -T postgres psql -U contest -d postgres -q \
    -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'contest' and pid <> pg_backend_pid()" \
    -c "drop database if exists contest with (force)" -c "create database contest" >/dev/null
  ensure_engine_env; migrate
  say "clearing uploaded problems"; rm -rf "$JUDGE/problems"/*
  warn "restart the engine so it recreates the admin account: ./run.sh down && ./run.sh up"
}

cmd_test() {
  say "judge tests (with the real sandbox if it is up)"
  local e2e=""; [ -n "$(docker ps -q -f name="^$GJ_CONTAINER$")" ] && e2e="JUDGE_E2E_URL=http://localhost:$GJ_PORT"
  ( cd "$JUDGE" && env $e2e .venv/bin/python -m pytest -q 2>&1 | tail -1 )
  say "engine tests (separate contest_engine_test database)"
  up_postgres; ensure_engine_venv
  docker compose -f "$WEB/docker-compose.yml" exec -T postgres psql -U contest -d postgres -tAc "select 1 from pg_database where datname='contest_engine_test'" | grep -q 1 \
    || docker compose -f "$WEB/docker-compose.yml" exec -T postgres psql -U contest -d postgres -q -c "create database contest_engine_test" >/dev/null
  ( cd "$ENGINE" && DATABASE_URL=postgres://contest:contest@localhost:5432/contest_engine_test .venv/bin/python -m pytest -q 2>&1 | tail -1 )
  say "web typecheck"
  ( cd "$WEB" && pnpm exec tsc --noEmit && echo "types ok" )
}

cmd_smoke() {
  ensure_env; ensure_engine_env; cmd_down >/dev/null; cmd_reset >/dev/null 2>&1 || true
  up_postgres; up_sandbox; up_judge; up_engine; up_web
  say "running the end-to-end smoke test (both phases, real judge)"
  ( cd "$WEB" && BASE_URL="http://localhost:$WEB_PORT" ADMIN_PASSWORD="$(env_get ADMIN_PASSWORD)" pnpm exec tsx tests/e2e/smoke.ts )
}

cmd_prod() {
  [ -f "$ROOT/.env" ] || die "create $ROOT/.env from .env.example first (secrets and BETTER_AUTH_URL)"
  say "bringing up the whole stack in Docker"
  docker compose -f "$ROOT/docker-compose.yml" up -d --build
  docker compose -f "$ROOT/docker-compose.yml" ps
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down "${2:-}" ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  reset) cmd_reset ;;
  test) cmd_test ;;
  smoke) cmd_smoke ;;
  prod) cmd_prod ;;
  *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
