"""
Pandora Codex API Routes
Hardware detection, DFU mode, Chain-Breaker operations.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import List, Dict
import asyncio

from .detector import scan_usb_devices, detect_dfu_mode
from .websocket import DeviceStreamManager
from .security import check_authorization

router = APIRouter()
stream_manager = DeviceStreamManager()


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
async def enter_dfu_mode(device_id: str):
    """
    Initiates an authorized request to put a device into DFU mode.
    
    Parameters:
        device_id (str): Identifier of the target device.
    
    Returns:
        JSONResponse: 
            - If authorization fails: status 403 with {"ok": False, "error": {"code": "UNAUTHORIZED", "message": <reason>}}.
            - If authorized: status 501 with {"ok": False, "error": {"code": "DFU_NOT_IMPLEMENTED", "message": "DFU entry automation is not available in this backend."}, "data": {"device_id": <device_id>, "instructions": [...]} }.
    """
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
        status_code=501,
        content={
            "ok": False,
            "error": {
                "code": "DFU_NOT_IMPLEMENTED",
                "message": "DFU entry automation is not available in this backend."
            },
            "data": {
                "device_id": device_id,
                "instructions": [
                    "Use device-specific DFU instructions in the UI.",
                    "Connect via USB and follow timed button sequences.",
                    "Verify DFU mode using libimobiledevice tools when available."
                ]
            }
        }
    )


@router.post("/jailbreak")
async def execute_jailbreak(device_id: str, exploit: str = "checkra1n"):
    """
    Attempt to initiate a jailbreak operation for the specified device.
    
    Checks caller authorization and returns a 403 response when unauthorized. If authorized, returns a 501 response indicating jailbreak automation is not implemented and includes details about the requested operation.
    
    Parameters:
        device_id (str): Identifier of the target device.
        exploit (str): Exploit to use for the jailbreak (default "checkra1n").
    
    Returns:
        JSONResponse: On unauthorized access, a 403 response with content:
            {
                "ok": False,
                "error": {"code": "UNAUTHORIZED", "message": <reason>}
            }
        On authorized requests, a 501 response with content:
            {
                "ok": False,
                "error": {
                    "code": "JAILBREAK_NOT_IMPLEMENTED",
                    "message": "Jailbreak automation is not available in this backend."
                },
                "data": {
                    "device_id": <device_id>,
                    "exploit": <exploit>,
                    "note": "Use supported jailbreak tooling via the trapdoor workflow if authorized."
                }
            }
    """
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
        status_code=501,
        content={
            "ok": False,
            "error": {
                "code": "JAILBREAK_NOT_IMPLEMENTED",
                "message": "Jailbreak automation is not available in this backend."
            },
            "data": {
                "device_id": device_id,
                "exploit": exploit,
                "note": "Use supported jailbreak tooling via the trapdoor workflow if authorized."
            }
        }
    )


@router.post("/flash")
async def flash_device(device_id: str, firmware_path: str):
    """
    Provide a standardized 501 JSON response indicating firmware flashing is not implemented.
    
    Parameters:
        device_id (str): Identifier of the target device.
        firmware_path (str): Filesystem path or identifier of the firmware to be flashed.
    
    Returns:
        JSONResponse: Response with `ok: False`, an `error` object with code `"FLASH_NOT_IMPLEMENTED"` and message `"Firmware flashing is not implemented in this backend."`, and a `data` object containing `device_id`, `firmware` (the provided firmware_path), and a `note` directing users to alternative flash workflows.
    """
    return JSONResponse(
        status_code=501,
        content={
            "ok": False,
            "error": {
                "code": "FLASH_NOT_IMPLEMENTED",
                "message": "Firmware flashing is not implemented in this backend."
            },
            "data": {
                "device_id": device_id,
                "firmware": firmware_path,
                "note": "Use the trapdoor flash workflows for authorized flashing."
            }
        }
    )


@router.websocket("/hardware/stream")
async def hardware_stream(websocket: WebSocket):
    """WebSocket stream for real-time hardware updates."""
    await websocket.accept()
    client_id = await stream_manager.add_client(websocket)
    
    try:
        # Send initial device list
        devices = scan_usb_devices()
        await websocket.send_json({
            "type": "devices",
            "data": devices
        })
        
        # Stream updates
        while True:
            # Poll for device changes
            await asyncio.sleep(1)
            current_devices = scan_usb_devices()
            
            await websocket.send_json({
                "type": "update",
                "data": current_devices,
                "timestamp": asyncio.get_event_loop().time()
            })
    except WebSocketDisconnect:
        stream_manager.remove_client(client_id)