# betng-service-kit

The shared FastAPI bootstrap for the BetNG Python services.

It is the Python counterpart of `packages/service-kit`, and exists for the
same reason: the three Python services must not drift apart on the things a
client and an operator see.

## What it provides

| Concern       | What it does                                                        |
| ------------- | ------------------------------------------------------------------- |
| Configuration | Reads the environment once, at startup, into frozen settings        |
| Logging       | One JSON object per line, matching the TypeScript services' shape   |
| Correlation   | Reuses or generates `x-request-id`, echoes it, stamps it on logs    |
| Errors        | Renders every failure as `{ error: { code, message, requestId } }`  |
| Health        | `GET /health` (liveness) and `GET /ready` (probes real dependencies) |

## Why a shared package

Three copies of configuration loading, log formatting and the error envelope
would diverge within a phase or two, and the divergence would be invisible
until a client hit the one service that answered differently. A service still
runs on its own — the package is installed as a path dependency, not a
service.

It contains no domain logic. Simulation mathematics, odds pricing and risk
analysis belong to the services that own them.

## Installing

Each service depends on it by path, so an editable install of the service
brings it along:

```bash
cd services/simulation
python -m venv .venv && source .venv/bin/activate
pip install -e ../shared -e '.[dev]'
```
