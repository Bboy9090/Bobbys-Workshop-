"""
Entitlement Enforcement - Canonical Authority
==============================================
All feature gating happens here. No exceptions.
"""

from .matrix import load_matrix, FEATURE_MATRIX
from typing import Optional

def is_allowed(feature: str, tier: str, matrix: dict = None) -> bool:
    """
    Check if a feature is allowed for a tier.
    
    Args:
        feature: Feature name (e.g. "clonezilla", "bulk_ops")
        tier: License tier (free | pro | enterprise)
        matrix: Optional custom matrix (uses default if None)
    
    Returns:
        True if feature is allowed
    """
    if matrix is None:
        matrix = load_matrix()
    
    allowed = matrix.get(tier, [])
    
    # Wildcard means all features
    if "*" in allowed:
        return True
    
    return feature in allowed

def require_tier(feature: str, min_tier: str) -> bool:
    """
    Check if feature requires minimum tier.
    
    Args:
        feature: Feature name
        min_tier: Minimum tier required (free | pro | enterprise)
    
    Returns:
        True if tier is sufficient
    """
    tier_order = {"free": 0, "pro": 1, "enterprise": 2}
    matrix = load_matrix()
    
    # Find minimum tier that allows this feature
    for tier in ["free", "pro", "enterprise"]:
        if is_allowed(feature, tier, matrix):
            required_level = tier_order.get(tier, 0)
            user_level = tier_order.get(min_tier, 0)
            return user_level >= required_level
    
    return False
