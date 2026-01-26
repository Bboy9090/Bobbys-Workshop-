"""
Core utilities for device diagnostics and tool execution.
"""

import subprocess
import sys
import os
from typing import List, Optional


def log(msg: str) -> None:
    """Log to stdout with timestamp."""
    print(msg, file=sys.stdout, flush=True)


def run_cmd(cmd: List[str], timeout: int = 30) -> str:
    """
    Run shell command and return output (captured).
    Use this for getting device serials, props, etc.
    
    Args:
        cmd: Command as list of strings (e.g., ["adb", "devices"])
        timeout: Maximum execution time in seconds
        
    Returns:
        Command output as string, or empty string on error
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.stdout
    except subprocess.TimeoutExpired:
        log(f"[ERROR] Command timed out: {' '.join(cmd)}")
        return ""
    except Exception as e:
        log(f"[ERROR] Command failed: {e}")
        return ""


def run_interactive(cmd: List[str]) -> bool:
    """
    Run shell command interactively (letting it take over stdout/stdin).
    Use this for tools like palera1n, checkra1n, or fastboot flashing.
    
    Args:
        cmd: Command as list of strings
        
    Returns:
        True if command succeeded, False otherwise
    """
    try:
        log(f"[EXEC] Running: {' '.join(cmd)}")
        # check=True will raise CalledProcessError if return code != 0
        subprocess.run(cmd, check=True, text=True)
        return True
    except subprocess.CalledProcessError as e:
        log(f"[ERROR] Tool exited with error code: {e.returncode}")
        return False
    except FileNotFoundError:
        log(f"[ERROR] Binary not found: {cmd[0]}")
        return False
    except Exception as e:
        log(f"[ERROR] Execution failed: {e}")
        return False


def check_device() -> bool:
    """Check if device is connected via ADB."""
    output = run_cmd(["adb", "devices"]).strip()
    lines = output.split("\n")
    if len(lines) > 1:
        for line in lines[1:]:
            if line.strip() and "offline" not in line and "device" in line:
                return True
    return False


def get_model() -> str:
    """Get device model from prop."""
    model = run_cmd(["adb", "shell", "getprop", "ro.product.model"]).strip()
    brand = run_cmd(["adb", "shell", "getprop", "ro.product.brand"]).strip()
    return f"{brand} {model}" if brand and model else model or "Unknown"
