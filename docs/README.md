# Documentation

| Document | What it covers |
|---|---|
| [contest-rules.md](contest-rules.md) | What the competition is, and the rules — participant-facing |
| [decisions.md](decisions.md) | Every architectural decision, with reasoning and the measurements behind it |
| [requirements-phase1.md](requirements-phase1.md) | Phase 1 — qualifying round: logical puzzles and hacking — 22 stories |
| [requirements-judge.md](requirements-judge.md) | Judge service — 31 stories |
| [requirements-backend.md](requirements-backend.md) | Phase 2 contest backend — 37 stories |
| [requirements-frontend.md](requirements-frontend.md) | Web client and admin dashboard — 33 stories |
| [lld.md](lld.md) | Low-level design for backend and frontend — schema, transactions, realtime |
| [phase2-question-zip.md](phase2-question-zip.md) | The format of a Phase 2 coding question zip, for whoever sets the problems |

## Where to start

- **Building Phase 1?** → `requirements-phase1.md`, then [`lld.md`](lld.md)
- **Building the judge?** → `requirements-judge.md`, then [`../judge/openapi.yaml`](../judge/openapi.yaml)
- **Building the backend?** → `requirements-backend.md`, then [`lld.md`](lld.md), then the OpenAPI spec for the judge contract
- **Setting a Phase 2 problem?** → [`phase2-question-zip.md`](phase2-question-zip.md)
- **Running the contest?** → `contest-rules.md`, and fix the pricing parameters in Section 12
- **Wondering why something is the way it is?** → `decisions.md`
