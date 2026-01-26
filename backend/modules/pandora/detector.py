"""
Hardware Detector
Detects USB devices, DFU mode, recovery mode.
"""

import os
import subprocess
from typing import List, Dict

# Apple Device Constants
APPLE_VID = 0x05ac
DFU_PID = 0x1227  # DFU mode
REC_PID = 0x1281  # Recovery mode
NORM_PID = 0x12a8  # Normal mode


def scan_usb_devices() -> List[Dict]:
    """Scan for USB devices using PyUSB or system commands."""
    devices = []
    
    try:
        # Try using lsusb (Linux) or system_profiler (macOS) or PowerShell (Windows)
        if os.name == 'nt':  # Windows
            # Use PowerShell to get USB devices
            cmd = [
                "powershell",
                "-Command",
                "Get-PnpDevice -Class USB | Select-Object FriendlyName, Status, InstanceId"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            # Parse output (simplified)
            devices.append({
                "id": "usb_device",
                "name": "USB Device",
                "status": "connected"
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
    """Detect devices in DFU mode using PyUSB."""
    devices = []
    
    try:
        import usb.core
        import usb.util
        
        # Find Apple devices
        apple_devices = usb.core.find(find_all=True, idVendor=APPLE_VID)
        
        for device in apple_devices:
            pid = device.idProduct
            
            if pid == DFU_PID:
                devices.append({
                    "id": f"{device.idVendor:04x}:{pid:04x}",
                    "name": "iOS Device (DFU Mode)",
                    "mode": "dfu",
                    "status": "connected",
                    "vid": hex(device.idVendor),
                    "pid": hex(pid)
                })
            elif pid == REC_PID:
                devices.append({
                    "id": f"{device.idVendor:04x}:{pid:04x}",
                    "name": "iOS Device (Recovery Mode)",
                    "mode": "recovery",
                    "status": "connected",
                    "vid": hex(device.idVendor),
                    "pid": hex(pid)
                })
            elif pid == NORM_PID:
                devices.append({
                    "id": f"{device.idVendor:04x}:{pid:04x}",
                    "name": "iOS Device (Normal Mode)",
                    "mode": "normal",
                    "status": "connected",
                    "vid": hex(device.idVendor),
                    "pid": hex(pid)
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
                            "mode": "dfu",
                            "status": "connected"
                        })
        except FileNotFoundError:
            pass
    except Exception as e:
        print(f"DFU detection error: {e}")
    
    return devices
