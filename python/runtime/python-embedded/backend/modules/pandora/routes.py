"""
Pandora Codex API Routes
Hardware detection, DFU mode, Chain-Breaker operations.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import List, Dict
import asyncio
import json
import os
import time
from pydantic import BaseModel

from .detector import scan_usb_devices, detect_dfu_mode
from .websocket import DeviceStreamManager
from .security import check_authorization
from .rig_health import RigMonitor

router = APIRouter()
stream_manager = DeviceStreamManager()
rig_monitor = RigMonitor()


async def _require_ws_auth(websocket: WebSocket) -> bool:
    """
    WebSocket auth: expect a first message like:
      {"type":"auth","passcode":"..."}
    """
    secret = os.getenv("SECRET_ROOM_PASSCODE") or os.getenv("TRAPDOOR_PASSCODE")
    if not secret:
        await websocket.close(code=1011)
        return False

    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        data = json.loads(raw)
    except Exception:
        await websocket.close(code=1008)
        return False

    if data.get("type") != "auth" or data.get("passcode") != secret:
        await websocket.close(code=1008)
        return False

    await websocket.send_json({"type": "auth_ok", "timestamp": time.time()})
    return True


@router.get("/hardware/status")
async def get_hardware_status():
    """Get current hardware status."""
    try:
        devices = scan_usb_devices()
        dfu_devices = detect_dfu_mode()
        
        return JSONResponse({
            "ok": True,
            "data": {
                "usb_devices": devices,
                "dfu_devices": dfu_devices,
                "total_devices": len(devices) + len(dfu_devices)
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "SCAN_FAILED", "message": str(e)}
            }
        )


@router.post("/enter-dfu")
async def enter_dfu_mode(request: "EnterDFURequest"):
    """Provide instructions for entering DFU mode (manual)."""
    # Check authorization
    authorized, reason = check_authorization()
    if not authorized:
        return JSONResponse(
            status_code=403,
            content={
                "ok": False,
                "error": {"code": "UNAUTHORIZED", "message": reason}
            }
        )
    
    try:
        # DFU entry requires physical button combinations; we do not claim success here.
        return JSONResponse({
            "ok": True,
            "data": {
                "device_id": request.device_id,
                "status": "manual_required",
                "message": "DFU mode entry requires physical button steps. Follow the instructions, then re-scan.",
                "instructions": [
                    "Keep the device connected via USB.",
                    "Use the device-specific DFU button sequence (screen should stay black in DFU).",
                    "After entering DFU, return here and confirm the device shows as DFU."
                ]
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "DFU_FAILED", "message": str(e)}
            }
        )


@router.post("/jailbreak")
async def execute_jailbreak(request: "JailbreakRequest"):
    """Not supported."""
    # Check authorization
    authorized, reason = check_authorization()
    if not authorized:
        return JSONResponse(
            status_code=403,
            content={
                "ok": False,
                "error": {"code": "UNAUTHORIZED", "message": reason}
            }
        )
    
    return JSONResponse(
        status_code=403,
        content={
            "ok": False,
            "error": {
                "code": "POLICY_BLOCKED",
                "message": "This operation is not available in this build."
            }
        }
    )


@router.post("/flash")
async def flash_device(request: "FlashRequest"):
    """Not implemented yet (truth-first)."""
    return JSONResponse(
        status_code=501,
        content={
            "ok": False,
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Firmware flashing is not implemented in this backend."
            }
        }
    )


class EnterDFURequest(BaseModel):
    device_id: str


class JailbreakRequest(BaseModel):
    device_id: str
    exploit: str


class FlashRequest(BaseModel):
    device_id: str
    firmware_path: str


@router.websocket("/hardware/stream")
async def hardware_stream(websocket: WebSocket):
    """WebSocket stream for real-time hardware updates."""
    await websocket.accept()

    if not await _require_ws_auth(websocket):
        return

    client_id = await stream_manager.add_client(websocket)
    
    try:
        # Send initial device list + DFU list
        devices = [
            *(scan_usb_devices() or []),
            *(detect_dfu_mode() or []),
        ]
        await websocket.send_json({
            "type": "devices",
            "data": devices
        })

        # Send initial rig telemetry
        await websocket.send_json({
            "type": "rig_telemetry",
            "data": rig_monitor.get_stats()
        })
        
        # Stream updates
        while True:
            # Poll for device changes
            await asyncio.sleep(1)
            current_devices = [
                *(scan_usb_devices() or []),
                *(detect_dfu_mode() or []),
            ]
            
            await websocket.send_json({
                "type": "update",
                "data": current_devices,
                "timestamp": asyncio.get_event_loop().time()
            })

            # Stream telemetry (same cadence)
            await websocket.send_json({
                "type": "rig_telemetry",
                "data": rig_monitor.get_stats()
            })
    except WebSocketDisconnect:
        stream_manager.remove_client(client_id)
