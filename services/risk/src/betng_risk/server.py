"""Process entry point."""

from __future__ import annotations

import uvicorn

from .app import create_app
from .configs import load_risk_settings


def main() -> None:
    """Run the service under uvicorn."""
    settings = load_risk_settings()

    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        # The shared kit owns the log format.
        log_config=None,
        access_log=False,
    )


if __name__ == "__main__":
    main()
