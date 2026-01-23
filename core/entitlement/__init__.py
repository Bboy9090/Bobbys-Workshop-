"""
Entitlement Core - Feature Gating Authority
===========================================
All feature gating logic lives here.
"""

from .enforce import is_allowed, require_tier
from .matrix import load_matrix, FEATURE_MATRIX

__all__ = [
    "is_allowed",
    "require_tier",
    "load_matrix",
    "FEATURE_MATRIX"
]
