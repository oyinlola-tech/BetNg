from __future__ import annotations

import uvicorn

from .app import create_app
from .configs import load_simulation_settings


def main() -> None:
    settings = load_simulation_settings()

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
