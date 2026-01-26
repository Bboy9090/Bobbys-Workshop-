"""
Pandora Codex Security
MAC address lock for authorized machines only.
"""

import os
import platform
from typing import Optional, List

# Whitelist of authorized MAC addresses
AUTHORIZED_MACS = os.getenv("PANDORA_AUTHORIZED_MACS", "").split(",")
AUTHORIZED_MACS = [mac.strip().upper() for mac in AUTHORIZED_MACS if mac.strip()]


def get_mac_address() -> Optional[str]:
    """Get MAC address of current machine."""
    try:
        import uuid
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                       for elements in range(0, 2*6, 2)][::-1])
        return mac.upper()
    except Exception:
        return None


def is_authorized() -> bool:
    """Check if current machine is authorized."""
    # If no whitelist configured, allow all (development mode)
    if not AUTHORIZED_MACS or AUTHORIZED_MACS == ['']:
        return True
    
    current_mac = get_mac_address()
    if not current_mac:
        return False
    
    return current_mac in AUTHORIZED_MACS


def check_authorization() -> tuple[bool, Optional[str]]:
    """Check authorization and return (is_authorized, reason)."""
    if not is_authorized():
        current_mac = get_mac_address()
        return False, f"MAC address {current_mac} not authorized. Contact administrator."
    
    return True, None
