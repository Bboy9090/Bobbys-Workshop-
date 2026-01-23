"""
Phoenix Core - Single Entry Point
==================================
All surfaces (API, CLI, USB) must use this.
"""

import os
from typing import Optional
from .license.verify import verify_license
from .license.types import License
from .license.grace import in_grace
from .entitlement.enforce import is_allowed, load_matrix
from .audit.log import append
from .audit.types import AuditEvent

class PhoenixCore:
    """
    Canonical core - single source of truth.
    
    Every surface (Flask, CLI, USB) must instantiate this
    and call authorize() before any protected action.
    """
    
    def __init__(self, signing_key: bytes = None, matrix_path: str = None):
        """
        Initialize Phoenix Core.
        
        Args:
            signing_key: HMAC signing key (hex string or bytes)
            matrix_path: Path to entitlement matrix JSON
        """
        # Load signing key
        if signing_key is None:
            key_str = os.environ.get("LICENSE_SIGNING_KEY", "")
            if key_str:
                try:
                    self.key = bytes.fromhex(key_str)
                except:
                    self.key = key_str.encode()
            else:
                self.key = b"dev-key-not-for-production"
        else:
            if isinstance(signing_key, str):
                self.key = bytes.fromhex(signing_key) if len(signing_key) > 32 else signing_key.encode()
            else:
                self.key = signing_key
        
        # Load entitlement matrix
        self.matrix = load_matrix(matrix_path)
    
    def authorize(self, token: str, feature: str, actor: str = "system") -> License:
        """
        Authorize a feature access.
        
        This is the ONLY way to check permissions.
        
        Args:
            token: License token (or empty string for free tier)
            feature: Feature name to check
            actor: Actor identifier (for audit)
        
        Returns:
            License object if authorized
        
        Raises:
            PermissionError: If license invalid or feature not allowed
        """
        # Try to verify license
        lic = None
        tier = "free"
        
        if token:
            from .license.verify import verify_license
            lic = verify_license(token, self.key)
            if lic:
                tier = lic.tier
            else:
                # Invalid token - log and deny
                append(AuditEvent(
                    actor=actor,
                    action="license.verify",
                    feature=feature,
                    result="denied",
                    reason="invalid_token"
                ))
                raise PermissionError("Invalid license token")
        
        # Check feature access
        if not is_allowed(feature, tier, self.matrix):
            append(AuditEvent(
                actor=actor,
                action="feature.access",
                feature=feature,
                result="denied",
                reason=f"tier_{tier}_insufficient"
            ))
            raise PermissionError(f"Feature '{feature}' requires higher tier than '{tier}'")
        
        # Log successful authorization
        append(AuditEvent(
            actor=actor,
            action="feature.access",
            feature=feature,
            result="success"
        ))
        
        # Return license (or free tier placeholder)
        if lic:
            return lic
        else:
            from .license.types import License
            return License(
                subject="free",
                tier="free",
                seats=1,
                capabilities=[],
                exp=None
            )
