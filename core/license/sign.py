"""
License Signing - Canonical Authority
=====================================
Signs license tokens using HMAC-SHA256 or Ed25519.
"""

import json
import hmac
import hashlib
import base64
import time
from typing import Optional
from .types import License

def sign_license(lic: License, key: bytes, algorithm: str = "hmac") -> str:
    """
    Sign a license object into a portable token.
    
    Args:
        lic: License object to sign
        key: Signing key (HMAC key or Ed25519 private key bytes)
        algorithm: "hmac" or "ed25519"
    
    Returns:
        Base64-encoded signed token
    """
    payload = {
        "subject": lic.subject,
        "tier": lic.tier,
        "seats": lic.seats,
        "capabilities": lic.capabilities,
        "exp": lic.exp,
        "org_id": lic.org_id,
        "issuer_id": lic.issuer_id,
        "env": lic.env,
        "license_id": lic.license_id,
        "iat": int(time.time())  # issued at
    }
    
    # Remove None values
    payload = {k: v for k, v in payload.items() if v is not None}
    
    raw = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
    
    if algorithm == "hmac":
        sig = hmac.new(key, raw, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(raw + b"." + sig).decode()
    else:
        # Ed25519 would go here
        raise ValueError(f"Algorithm {algorithm} not implemented")
