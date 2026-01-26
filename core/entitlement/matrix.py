"""
Entitlement Matrix - Feature Definitions
=========================================
Canonical feature matrix loaded from JSON.
"""

import json
import os
from pathlib import Path

# Default matrix (embedded)
FEATURE_MATRIX = {
    "free": [
        "boot",
        "basic_recovery",
        "list_devices",
        "view_logs"
    ],
    "pro": [
        "*"
    ],
    "enterprise": [
        "*",
        "audit_export",
        "bulk_ops",
        "org_management",
        "seat_management",
        "custom_capabilities"
    ]
}

def load_matrix(path: str = None) -> dict:
    """
    Load entitlement matrix from file or use default.
    
    Args:
        path: Path to matrix.json file
    
    Returns:
        Feature matrix dictionary
    """
    if path and os.path.exists(path):
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    
    # Try default location
    default_path = Path(__file__).parent / "matrix.json"
    if default_path.exists():
        try:
            with open(default_path, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    
    return FEATURE_MATRIX
