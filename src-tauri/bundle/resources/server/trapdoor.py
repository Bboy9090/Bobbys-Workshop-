"""Authentication gate for the BootForge USB device-flashing API.

This API can trigger real adb/fastboot commands against physically
connected phones (scan, reboot, flash, pause/resume/cancel a flash job).
It previously had zero authentication and was bound to 0.0.0.0 with CORS
allow_origins=["*"] + allow_credentials=True -- any page loaded in any
browser on the machine, or any host on the network if ever bound non-
locally, could trigger a device flash with no gate at all.

This mirrors the existing SECRET_ROOM_PASSCODE convention already used
elsewhere in this project (the Express trapdoor-auth middleware, and
backend/server.py's Phoenix Forge API): one passcode, read from the
environment, checked with a constant-time comparison, required on every
HTTP route and passed as a query parameter on WebSocket connections
(browser WebSocket clients cannot set custom headers).

Fails CLOSED: if no passcode is configured, every request is rejected
rather than silently allowed through.
"""
from __future__ import annotations

import hmac
import os
from typing import Optional

from fastapi import Header, HTTPException


def _required_passcode() -> Optional[str]:
    return os.environ.get("SECRET_ROOM_PASSCODE") or os.environ.get("TRAPDOOR_PASSCODE")


def check_passcode(value: Optional[str]) -> bool:
    required = _required_passcode()
    if not required or not value:
        return False
    return hmac.compare_digest(value, required)


async def verify_auth(x_secret_room_passcode: Optional[str] = Header(default=None)) -> bool:
    required = _required_passcode()
    if not required:
        raise HTTPException(
            status_code=503,
            detail="Secret Room passcode not configured (set SECRET_ROOM_PASSCODE).",
        )
    if not check_passcode(x_secret_room_passcode):
        raise HTTPException(status_code=401, detail="Invalid or missing Secret Room passcode.")
    return True
