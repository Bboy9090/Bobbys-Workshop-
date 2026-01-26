"""
Environment Configuration - No Logic Drift
===========================================
Environment-specific settings. Logic never changes.
"""

import os

ENV = os.getenv("PHOENIX_ENV", "DEV")

CONFIG = {
    "DEV": {
        "audit": False,
        "strict_license": False,
        "grace_period": 86400 * 30  # 30 days
    },
    "STAGING": {
        "audit": True,
        "strict_license": True,
        "grace_period": 86400 * 7  # 7 days
    },
    "PROD": {
        "audit": True,
        "strict_license": True,
        "grace_period": 86400 * 7  # 7 days
    },
    "AIRGAP": {
        "audit": True,
        "strict_license": True,
        "grace_period": 86400 * 30  # 30 days (offline needs more grace)
    }
}

def get_config(env: str = None) -> dict:
    """Get configuration for environment."""
    if env is None:
        env = ENV
    return CONFIG.get(env, CONFIG["DEV"])
