"""
License Revocation - Canonical Authority
=========================================
Manages revocation lists. Offline-capable.
"""

import json
import os
from pathlib import Path
from typing import Set

# In-memory revocation set (loaded from disk)
_REVOKED: Set[str] = set()

# Default revocation file paths (USB + local)
REVOCATION_PATHS = [
    "/sysresccd/autorun/phoenix/revocations.bundle",
    "/forge_state/revocations.bundle",
    "./revocations.bundle"
]

def load_revocations(path: str = None) -> Set[str]:
    """
    Load revocation list from file.
    
    Args:
        path: Path to revocation bundle JSON file
    
    Returns:
        Set of revoked license IDs
    """
    revoked = set()
    
    if path and os.path.exists(path):
        try:
            with open(path, 'r') as f:
                data = json.load(f)
                revoked.update(data.get("revoked_licenses", []))
                revoked.update(data.get("revoked_issuers", []))
        except Exception:
            pass
    
    # Also check default paths
    for default_path in REVOCATION_PATHS:
        if os.path.exists(default_path):
            try:
                with open(default_path, 'r') as f:
                    data = json.load(f)
                    revoked.update(data.get("revoked_licenses", []))
                    revoked.update(data.get("revoked_issuers", []))
            except Exception:
                pass
    
    _REVOKED.update(revoked)
    return revoked

def revoke(license_id: str):
    """Add license ID to revocation set."""
    _REVOKED.add(license_id)

def is_revoked(license_id: str) -> bool:
    """Check if license ID is revoked."""
    if not _REVOKED:
        load_revocations()  # Auto-load on first check
    return license_id in _REVOKED
