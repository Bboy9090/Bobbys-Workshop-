"""
Phoenix Key / BootForge - Canonical Core
=========================================
Single source of truth for licensing, entitlement, and audit.

This module must be imported by ALL surfaces:
- Flask API
- CLI tools
- USB runtime
- Future Rust daemon

No business logic lives outside /core.
"""

__version__ = "1.0.0"
