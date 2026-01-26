"""
License Grace Period - Canonical Authority
===========================================
Handles grace periods for expired licenses.
"""

import time

DEFAULT_GRACE_SECONDS = 604800  # 7 days

def in_grace(exp: int, grace_seconds: int = DEFAULT_GRACE_SECONDS) -> bool:
    """
    Check if license is within grace period.
    
    Args:
        exp: Expiry timestamp
        grace_seconds: Grace period in seconds
    
    Returns:
        True if expired but within grace period
    """
    if not exp:
        return False
    
    now = time.time()
    if now > exp:
        return (now - exp) < grace_seconds
    return False

def get_grace_remaining(exp: int, grace_seconds: int = DEFAULT_GRACE_SECONDS) -> int:
    """
    Get remaining grace period seconds.
    
    Returns:
        Seconds remaining in grace, or 0 if not in grace
    """
    if not in_grace(exp, grace_seconds):
        return 0
    
    now = time.time()
    return int(grace_seconds - (now - exp))
