"""Startup wiring."""

from .container_loader import OddsDependencies, load_container
from .services_loader import load_services

__all__ = ["OddsDependencies", "load_container", "load_services"]
