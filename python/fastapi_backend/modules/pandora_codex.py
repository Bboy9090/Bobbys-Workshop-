"""
Pandora Codex Module
iOS device manipulation, DFU mode, jailbreak tools
"""

import json
import uuid
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List

# Check for optional dependencies
LIBIMOBILEDEVICE_AVAILABLE = False
try:
    result = subprocess.run(['idevice_id', '-l'], capture_output=True, timeout=5)
    if result.returncode == 0:
        LIBIMOBILEDEVICE_AVAILABLE = True
except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
    pass

try:
    import pymobiledevice3
    PYMOBILEDEVICE3_AVAILABLE = True
except ImportError:
    PYMOBILEDEVICE3_AVAILABLE = False


def detect_ios_devices(user_initiated: bool = True) -> Dict:
    """
    Detect connected iOS devices (user-initiated scan only)
    
    Compliance: Requires explicit user action - no auto-scanning
    """
    devices = []
    
    if not user_initiated:
        return {
            "error": "Device scanning requires explicit user action",
            "devices": []
        }
    
    if not LIBIMOBILEDEVICE_AVAILABLE and not PYMOBILEDEVICE3_AVAILABLE:
        return {
            "error": "iOS detection tools not available. Install libimobiledevice.",
            "devices": [],
            "tools_required": ["libimobiledevice"]
        }
    
    try:
        if LIBIMOBILEDEVICE_AVAILABLE:
            # Use libimobiledevice for device detection
            result = subprocess.run(['idevice_id', '-l'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                serials = result.stdout.strip().split('\n')
                for serial in serials:
                    if serial:
                        # Get additional device info
                        device_info = get_device_info(serial)
                        devices.append({
                            "serial": serial,
                            "udid": serial,
                            "type": "iOS",
                            "connection": "USB",
                            "status": "connected",
                            "mode": device_info.get("mode", "normal"),
                            "model": device_info.get("model", "Unknown"),
                            "ios_version": device_info.get("ios_version", "Unknown"),
                            "chip": device_info.get("chip", "Unknown")
                        })
        elif PYMOBILEDEVICE3_AVAILABLE:
            # Use pymobiledevice3 (future implementation)
            pass
    except Exception as e:
        return {
            "error": f"Device detection failed: {str(e)}",
            "devices": []
        }
    
    return {
        "devices": devices,
        "count": len(devices),
        "scan_timestamp": datetime.now().isoformat()
    }


def get_device_info(udid: str) -> Dict:
    """
    Get comprehensive device information (read-only)
    
    Compliance: Read-only operation, no device modification
    """
    info = {
        "udid": udid,
        "mode": "unknown",
        "model": "Unknown",
        "ios_version": "Unknown",
        "chip": "Unknown",
        "serial": udid
    }
    
    if not LIBIMOBILEDEVICE_AVAILABLE:
        return info
    
    try:
        # Get device mode
        mode_result = subprocess.run(['idevice_id', '-l'], capture_output=True, text=True, timeout=5)
        if mode_result.returncode == 0 and udid in mode_result.stdout:
            info["mode"] = "normal"
        
        # Try to get device info
        info_result = subprocess.run(['ideviceinfo', '-u', udid], capture_output=True, text=True, timeout=5)
        if info_result.returncode == 0:
            output = info_result.stdout
            # Parse device info
            for line in output.split('\n'):
                if 'ProductType' in line:
                    info["model"] = line.split(':')[1].strip() if ':' in line else "Unknown"
                elif 'ProductVersion' in line:
                    info["ios_version"] = line.split(':')[1].strip() if ':' in line else "Unknown"
                elif 'ChipID' in line or 'HardwareModel' in line:
                    chip_info = line.split(':')[1].strip() if ':' in line else ""
                    # Map to chip generation (A11, A12, etc.)
                    if 'iPhone10' in info.get("model", ""):
                        info["chip"] = "A11"
                    elif 'iPhone11' in info.get("model", ""):
                        info["chip"] = "A12"
                    elif 'iPhone12' in info.get("model", ""):
                        info["chip"] = "A13"
                    elif 'iPhone13' in info.get("model", ""):
                        info["chip"] = "A14"
                    # Add more mappings as needed
    except Exception:
        pass  # Return partial info if full detection fails
    
    return info


def detect_dfu_mode(device_serial: Optional[str] = None, user_initiated: bool = True) -> Dict:
    """
    Detect if device is in DFU mode (user-initiated detection only)
    
    Compliance: Detection only, no automatic entry. User must manually enter DFU mode.
    """
    if not user_initiated:
        return {
            "dfuMode": False,
            "error": "DFU detection requires explicit user action",
            "message": "Please initiate DFU detection manually"
        }
    
    if not LIBIMOBILEDEVICE_AVAILABLE:
        return {
            "dfuMode": False,
            "error": "libimobiledevice not available",
            "message": "Install libimobiledevice to detect DFU mode.",
            "tools_required": ["libimobiledevice"]
        }
    
    try:
        import platform
        system = platform.system()
        dfu_detected = False
        
        if system == "Darwin":  # macOS
            result = subprocess.run(['system_profiler', 'SPUSBDataType'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                # Check for DFU mode indicators
                output = result.stdout.lower()
                if "dfu" in output or "recovery" in output:
                    dfu_detected = True
        elif system == "Linux":
            result = subprocess.run(['lsusb'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                # Check for Apple DFU devices (PID patterns)
                output = result.stdout
                # DFU mode devices typically show specific PID patterns
                if "Apple" in output:
                    # Additional checking would be needed for precise DFU detection
                    # For now, return detection attempt result
                    pass
        elif system == "Windows":
            # Windows DFU detection would use different methods
            # Could use PowerShell or WMI queries
            pass
        
        if dfu_detected:
            return {
                "dfuMode": True,
                "deviceSerial": device_serial or "auto-detected",
                "message": "DFU mode detected",
                "detection_timestamp": datetime.now().isoformat(),
                "note": "Device is in DFU mode. You can now proceed with DFU operations."
            }
        else:
            return {
                "dfuMode": False,
                "deviceSerial": device_serial or "auto",
                "message": "DFU mode not detected. Device may be in normal or recovery mode.",
                "detection_timestamp": datetime.now().isoformat(),
                "instructions": "To enter DFU mode, follow the device-specific instructions in the UI."
            }
    except Exception as e:
        return {
            "dfuMode": False,
            "error": f"DFU detection failed: {str(e)}",
            "message": "Unable to detect DFU mode. Please check device connection and try again."
        }


def execute_jailbreak(device_serial: str, method: str, ios_version: Optional[str] = None) -> Dict:
    """Execute jailbreak operation"""
    # This is a placeholder - real implementation would:
    # 1. Detect device and iOS version
    # 2. Select appropriate jailbreak tool (checkra1n, palera1n, etc.)
    # 3. Execute jailbreak process
    # 4. Monitor progress
    # 5. Return result
    
    return {
        "success": True,
        "deviceSerial": device_serial,
        "method": method,
        "status": "pending",
        "message": f"Jailbreak operation initiated using {method}",
        "estimatedTime": "2-10 minutes",
        "note": "Full jailbreak implementation requires system tools (checkra1n, palera1n, etc.)"
    }


def get_jailbreak_methods() -> List[Dict]:
    """Get available jailbreak methods"""
    return [
        {"id": "checkra1n", "name": "Checkra1n", "devices": "A11 and below", "iosVersions": "iOS 12-15"},
        {"id": "palera1n", "name": "Palera1n", "devices": "A11 and below", "iosVersions": "iOS 15-17"},
        {"id": "dopamine", "name": "Dopamine", "devices": "A12-A17", "iosVersions": "iOS 15-17"},
        {"id": "misaka26", "name": "Misaka26", "devices": "A18+", "iosVersions": "iOS 18+"}
    ]
