# Codolympics

An auction-based coding competition. Phase 1 qualifies participants with logical
puzzles and hacking; Phase 2 auctions problems to them, one owner each, and judges
their code in a sandbox.

```bash
./run.sh up       # Postgres, sandbox, judge, web — dev mode, http://localhost:3000
./run.sh smoke    # prove the whole thing end to end (both phases, real judge)
./run.sh prod     # the whole stack in Docker for the contest machine
```

| Part | What | Docs |
|---|---|---|
| `docs/` | rules, decisions, requirements, low-level design | [docs/README.md](docs/README.md) |
| `judge/` | the judge service — the only thing that runs code | [judge/README.md](judge/README.md) |
| `worker/` | the sandbox image: go-judge plus the compilers | [worker/Dockerfile](worker/Dockerfile) |
| `web/` | the contest app: UI and API for both phases | [web/README.md](web/README.md) |

Nothing loads from outside the contest server; the hall has no internet.
