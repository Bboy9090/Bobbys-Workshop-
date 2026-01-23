"""
License Core - Canonical Authority
==================================
All license verification, signing, and revocation happens here.
"""

from .verify import verify_license
from .sign import sign_license
from .revoke import revoke, is_revoked
from .grace import in_grace
from .types import License

__all__ = [
    "verify_license",
    "sign_license",
    "revoke",
    "is_revoked",
    "in_grace",
    "License"
]
