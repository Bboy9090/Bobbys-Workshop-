"""
Pandora Codex API Routes
Hardware detection, DFU mode, Chain-Breaker operations.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import List, Dict
import asyncio
import subprocess

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
    """Attempt to enter DFU mode on device."""
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
        # Connect to real backend service (libimobiledevice/irecovery)
        result = subprocess.run(["irecovery", "-e", device_id], capture_output=True, text=True)
        status = "dfu_mode_entered" if result.returncode == 0 else "dfu_failed"
        
        return JSONResponse({
            "ok": True,
            "data": {
                "device_id": device_id,
                "status": status,
                "output": result.stdout,
                "message": "Device entered DFU mode" if result.returncode == 0 else "DFU entry simulated/failed"
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
async def execute_jailbreak(device_id: str, exploit: str = "checkra1n"):
    """Execute jailbreak on device."""
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
        # Connect to actual jailbreak binary
        binary = exploit if exploit in ["checkra1n", "palera1n"] else "checkra1n"
        result = subprocess.run([binary, "-c", device_id], capture_output=True, text=True)
        status = "jailbreak_initiated" if result.returncode == 0 else "jailbreak_failed"
        
        return JSONResponse({
            "ok": True,
            "data": {
                "device_id": device_id,
                "exploit": exploit,
                "status": status,
                "output": result.stdout,
                "message": "Jailbreak process started" if result.returncode == 0 else "Exploit simulated/failed"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "JAILBREAK_FAILED", "message": str(e)}
            }
        )


@router.post("/flash")
async def flash_device(device_id: str, firmware_path: str):
    """Flash firmware to device."""
    try:
        # Connect to system flashing tool
        result = subprocess.run(["fastboot", "-s", device_id, "flash", "all", firmware_path], capture_output=True, text=True)
        status = "flashing" if result.returncode == 0 else "flashing_failed"

        return JSONResponse({
            "ok": True,
            "data": {
                "device_id": device_id,
                "firmware": firmware_path,
                "status": status,
                "output": (result.stdout or "")[:200] + "...",
                "message": "Firmware flash initiated" if result.returncode == 0 else "Flash simulated/failed"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "FLASH_FAILED", "message": str(e)}
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
