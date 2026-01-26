"""
Hardware Detector
Detects USB devices, DFU mode, recovery mode.
"""

import os
import subprocess
import json
from typing import List, Dict

# Apple Device Constants
APPLE_VID = 0x05ac
DFU_PID = 0x1227  # DFU mode
REC_PID = 0x1281  # Recovery mode
NORM_PID = 0x12a8  # Normal mode


def _get_libusb_backend():
    """
    Best-effort libusb backend selection for PyUSB.

    On Windows, PyUSB often requires libusb-1.0 to be installed and discoverable.
    Optionally set:
      PYUSB_LIBUSB1_PATH=C:\\path\\to\\libusb-1.0.dll
    """
    try:
        import usb.backend.libusb1
    except Exception:
        return None

    libusb_path = os.environ.get("PYUSB_LIBUSB1_PATH")
    if libusb_path:
        return usb.backend.libusb1.get_backend(find_library=lambda _: libusb_path)
    return usb.backend.libusb1.get_backend()


def _try_get_serial(device) -> str:
    try:
        sn = device.serial_number
        return sn if sn else ""
    except Exception:
        return ""


def scan_usb_devices() -> List[Dict]:
    """Scan for USB devices using PyUSB or system commands."""
    devices = []
    
    try:
        # Try using lsusb (Linux) or system_profiler (macOS) or PowerShell (Windows)
        if os.name == 'nt':  # Windows
            # Use PowerShell to get USB devices (structured JSON)
            # NOTE: ConvertTo-Json returns an object or array depending on count.
            cmd = [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-PnpDevice -Class USB | Select-Object FriendlyName, Status, InstanceId | ConvertTo-Json -Depth 3"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0 and result.stdout.strip():
                parsed = json.loads(result.stdout)
                rows = parsed if isinstance(parsed, list) else [parsed]
                for row in rows:
                    instance_id = (row.get("InstanceId") or "unknown").strip()
                    name = (row.get("FriendlyName") or "USB Device").strip()
                    status = (row.get("Status") or "unknown").strip().lower()
                    devices.append({
                        "id": instance_id,
                        "name": name,
                        "status": status
                    })
        else:
            # Try lsusb
            result = subprocess.run(
                ["lsusb"],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if line.strip():
                        devices.append({
                            "id": line.split()[5] if len(line.split()) > 5 else "unknown",
                            "name": " ".join(line.split()[6:]) if len(line.split()) > 6 else "USB Device",
                            "status": "connected"
                        })
    except Exception as e:
        print(f"USB scan error: {e}")
    
    return devices


def detect_dfu_mode() -> List[Dict]:
    """Detect Apple devices in DFU/Recovery/Normal USB modes (read-only)."""
    devices = []
    
    try:
        import usb.core
        backend = _get_libusb_backend()
        
        # Find Apple devices
        apple_devices = usb.core.find(find_all=True, idVendor=APPLE_VID, backend=backend)
        
        for device in apple_devices:
            pid = device.idProduct
            serial = _try_get_serial(device)
            
            if pid == DFU_PID:
                devices.append({
                    "id": f"{device.idVendor:04x}:{pid:04x}",
                    "name": "iOS Device (DFU Mode)",
                    "mode": "dfu",
                    "status": "connected",
                    "vid": hex(device.idVendor),
                    "pid": hex(pid),
                    "serial_number": serial or None
                })
            elif pid == REC_PID:
                devices.append({
                    "id": f"{device.idVendor:04x}:{pid:04x}",
                    "name": "iOS Device (Recovery Mode)",
                    "mode": "recovery",
                    "status": "connected",
                    "vid": hex(device.idVendor),
                    "pid": hex(pid),
                    "serial_number": serial or None
                })
            elif pid == NORM_PID:
                devices.append({
                    "id": f"{device.idVendor:04x}:{pid:04x}",
                    "name": "iOS Device (Normal Mode)",
                    "mode": "normal",
                    "status": "connected",
                    "vid": hex(device.idVendor),
                    "pid": hex(pid),
                    "serial_number": serial or None
                })
    except ImportError:
        # PyUSB not installed, fallback to idevice_id
        try:
            result = subprocess.run(
                ["idevice_id", "-l"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                for device_id in result.stdout.strip().split('\n'):
                    if device_id:
                        devices.append({
                            "id": device_id,
                            "name": "iOS Device",
                            "mode": "normal",
                            "status": "connected"
                        })
        except FileNotFoundError:
            pass
    except Exception as e:
        print(f"DFU detection error: {e}")
    
    return devices
