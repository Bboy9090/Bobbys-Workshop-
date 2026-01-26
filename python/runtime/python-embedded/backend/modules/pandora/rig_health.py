"""
Rig health telemetry (real-time, best-effort).

- Uses psutil if available.
- Falls back gracefully if not installed or if sensors aren't available.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional


def _try_import_psutil():
    try:
        import psutil  # type: ignore
        return psutil
    except Exception:
        return None


class RigMonitor:
    def __init__(self):
        self._psutil = _try_import_psutil()
        self._last_cpu_percent: Optional[float] = None

        # Prime cpu_percent to avoid a misleading 0 on first call
        if self._psutil is not None:
            try:
                self._psutil.cpu_percent(interval=None)
            except Exception:
                pass

    def get_stats(self) -> Dict[str, Any]:
        psutil = self._psutil

        cpu_load = None
        ram_usage = None
        cpu_temp = None

        if psutil is not None:
            try:
                cpu_load = float(psutil.cpu_percent(interval=None))
            except Exception:
                cpu_load = None

            try:
                ram_usage = float(psutil.virtual_memory().percent)
            except Exception:
                ram_usage = None

            cpu_temp = self._get_cpu_temp(psutil)

        usb_pressure = self._estimate_usb_pressure(psutil)

        status = "STABLE"
        if cpu_temp is not None and cpu_temp >= 85:
            status = "CRITICAL"
        elif cpu_load is not None and cpu_load >= 90:
            status = "CRITICAL"
        elif cpu_temp is not None and cpu_temp >= 75:
            status = "WARN"
        elif cpu_load is not None and cpu_load >= 80:
            status = "WARN"

        return {
            "cpu_load": cpu_load,
            "cpu_temp": cpu_temp,
            "ram_usage": ram_usage,
            "usb_pressure": usb_pressure,
            "usb_pressure_note": "estimate",
            "status": status,
            "timestamp": time.time(),
        }

    def _get_cpu_temp(self, psutil) -> Optional[float]:
        """
        Best-effort temp reading. Often unavailable on Windows without extra drivers.
        """
        try:
            temps = psutil.sensors_temperatures(fahrenheit=False)
        except Exception:
            return None

        if not temps:
            return None

        # Prefer common keys if present
        preferred_groups = ["coretemp", "k10temp", "cpu_thermal", "acpitz"]
        for key in preferred_groups:
            group = temps.get(key)
            if group:
                for entry in group:
                    if getattr(entry, "current", None) is not None:
                        return float(entry.current)

        # Otherwise take first available
        for group in temps.values():
            for entry in group:
                if getattr(entry, "current", None) is not None:
                    return float(entry.current)

        return None

    def _estimate_usb_pressure(self, psutil) -> int:
        """
        Simple heuristic. Returns 0-100.
        - Counts active processes commonly used during USB ops.
        """
        if psutil is None:
            return 0

        names = {"adb", "fastboot", "python", "python3", "pythonw", "usbmuxd"}
        count = 0

        try:
            for proc in psutil.process_iter(["name"]):
                n = (proc.info.get("name") or "").lower()
                if n in names:
                    count += 1
        except Exception:
            return 0

        return min(count * 20, 100)

