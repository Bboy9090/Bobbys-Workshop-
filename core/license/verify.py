"""
License Verification - Canonical Authority
==========================================
Verifies license tokens offline. No network required.
"""

import json
import hmac
import hashlib
import base64
import time
from typing import Optional
from .types import License
from .revoke import is_revoked

def verify_license(token: str, key: bytes, algorithm: str = "hmac") -> Optional[License]:
    """
    Verify a license token and return License object if valid.
    
    Args:
        token: Base64-encoded signed token
        key: Verification key (HMAC key or Ed25519 public key bytes)
        algorithm: "hmac" or "ed25519"
    
    Returns:
        License object if valid, None if invalid/expired/revoked
    """
    try:
        # Decode base64 token (handle padding)
        token_bytes = token.encode()
        # Add padding if needed
        missing_padding = len(token_bytes) % 4
        if missing_padding:
            token_bytes += b'=' * (4 - missing_padding)
        raw = base64.urlsafe_b64decode(token_bytes)
        
        # Split data and signature
        if b"." not in raw:
            return None
        data, sig = raw.rsplit(b".", 1)
        
        if algorithm == "hmac":
            good = hmac.new(key, data, hashlib.sha256).digest()
            if not hmac.compare_digest(sig, good):
                return None
        else:
            # Ed25519 verification would go here
            return None
        
        payload = json.loads(data.decode())
        
        # Check expiry
        if payload.get("exp") and time.time() > payload["exp"]:
            return None
        
        # Check revocation
        license_id = payload.get("license_id")
        if license_id and is_revoked(license_id):
            return None
        
        # Construct License object
        return License(
            subject=payload.get("subject", ""),
            tier=payload.get("tier", "free"),
            seats=payload.get("seats", 1),
            capabilities=payload.get("capabilities", []),
            exp=payload.get("exp"),
            org_id=payload.get("org_id"),
            issuer_id=payload.get("issuer_id"),
            env=payload.get("env"),
            license_id=license_id
        )
    except Exception:
        return None
