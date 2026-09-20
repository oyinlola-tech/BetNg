"""Bootstrap wiring: what gets registered, and with what."""

from .container_loader import load_container
from .services_loader import load_services

__all__ = ["load_container", "load_services"]
