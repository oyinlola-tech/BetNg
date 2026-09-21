"""Process entry point."""

from __future__ import annotations

import uvicorn

from .app import create_app
from .configs import load_odds_settings


def main() -> None:
    """Serve the odds service on the configured host and port."""
    settings = load_odds_settings()

    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        # The shared kit owns the log format; uvicorn's own config would
        # install a second formatter on the same stream.
        log_config=None,
        access_log=False,
    )


if __name__ == "__main__":
    main()
