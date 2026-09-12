# Documentation

| Document | What it covers |
|---|---|
| [contest-rules.md](contest-rules.md) | What the competition is, and the rules — participant-facing |
| [decisions.md](decisions.md) | Every architectural decision, with reasoning and the measurements behind it |
| [requirements-judge.md](requirements-judge.md) | Judge service — 28 stories |
| [requirements-backend.md](requirements-backend.md) | Contest backend — 33 stories |
| [requirements-frontend.md](requirements-frontend.md) | Web client and admin dashboard — 32 stories |

## Where to start

- **Building the judge?** → `requirements-judge.md`, then [`../judge/openapi.yaml`](../judge/openapi.yaml)
- **Building the backend?** → `requirements-backend.md`, then the OpenAPI spec for the judge contract
- **Running the contest?** → `contest-rules.md`, and fix the pricing parameters in Section 12
- **Wondering why something is the way it is?** → `decisions.md`
