"""
Trapdoor - Orchestration layer for external private tools.
Handles execution of Jailbreaks, FRP bypass, MDM tools, etc.
Includes SHA256 hash verification for tool authenticity.
"""

import os
import sys
import platform
import hashlib
from typing import Optional, Dict, Any
from .core import log, run_interactive, run_cmd

# Import core utilities if they exist, otherwise define minimal versions
try:
    from .core import log, run_interactive, run_cmd
except ImportError:
    # Fallback if core module doesn't exist
    def log(msg: str) -> None:
        """Log to stdout with timestamp."""
        print(msg, file=sys.stdout, flush=True)
    
    def run_cmd(cmd: list, timeout: int = 30) -> str:
        """Run shell command and return output."""
        import subprocess
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            return result.stdout
        except Exception as e:
            log(f"[ERROR] Command failed: {e}")
            return ""
    
    def run_interactive(cmd: list) -> bool:
        """Run shell command interactively."""
        import subprocess
        try:
            log(f"[EXEC] Running: {' '.join(cmd)}")
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

# ---------------------------------------------------------
# PATH CONFIGURATION
# ---------------------------------------------------------
# We look for the folder named ".bootforge_private" or "private_tools"
# one level up from this script (assuming this script is in python/app/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PRIVATE_BASE = os.path.join(BASE_DIR, ".bootforge_private")

# Fallback if user named it "private_tools" or "toolkits" (legacy)
if not os.path.exists(PRIVATE_BASE):
    alternatives = ["private_tools", "toolkits", ".bootforge_private"]
    for alt in alternatives:
        temp_path = os.path.join(BASE_DIR, alt)
        if os.path.exists(temp_path):
            PRIVATE_BASE = temp_path
            break

# Also check in home directory
if not os.path.exists(PRIVATE_BASE):
    home_private = os.path.join(os.path.expanduser("~"), ".bootforge_private")
    if os.path.exists(home_private):
        PRIVATE_BASE = home_private

# ---------------------------------------------------------
# PLATFORM DETECTION (For ADB/Fastboot)
# ---------------------------------------------------------
SYSTEM_OS = platform.system().lower()  # 'linux', 'darwin' (mac), 'windows'

def get_platform_binary(tool_prefix: str) -> str:
    """Returns the correct binary name based on OS (e.g. adblinux vs adbosx)"""
    if "linux" in SYSTEM_OS:
        return f"{tool_prefix}linux"
    elif "darwin" in SYSTEM_OS:  # Mac
        return f"{tool_prefix}osx"
    else:
        return f"{tool_prefix}.exe"  # Windows assumption

# ---------------------------------------------------------
# TOOL INVENTORY WITH SHA256 HASHES
# ---------------------------------------------------------
# IMPORTANT: Replace None values with actual SHA256 hashes from official sources
# To get a hash: shasum -a 256 path/to/binary
TOOLS: Dict[str, Dict[str, Any]] = {
    # --- CORE ---
    "adb": {
        "path": os.path.join(PRIVATE_BASE, get_platform_binary("adb")),
        "desc": "Android Debug Bridge (Platform Specific)",
        "args": ["devices", "-l"],
        "type": "bin",
        "sha256": None  # TODO: Add official SHA256 hash
    },
    "fastboot": {
        "path": os.path.join(PRIVATE_BASE, get_platform_binary("fastboot")),
        "desc": "Android Fastboot Tool (Platform Specific)",
        "args": ["devices"],
        "type": "bin",
        "sha256": None  # TODO: Add official SHA256 hash
    },

    # --- EXPLOITS (ROOT) ---
    "dirtycow": {
        "path": os.path.join(PRIVATE_BASE, "dirtycow"),
        "desc": "CVE-2016-5195 Root Exploit (DirtyCOW)",
        "args": [],  # Usually takes arguments like /system/bin/applypatch
        "type": "exploit",
        "sha256": None  # TODO: Add official SHA256 hash
    },
    "recowvery": {
        "path": os.path.join(PRIVATE_BASE, "recowvery-app_process32"),
        "desc": "Recowvery Root Payload (app_process32)",
        "args": [],
        "type": "exploit",
        "sha256": None  # TODO: Add official SHA256 hash
    },

    # --- JAILBREAKS ---
    "palera1n": {
        "path": os.path.join(PRIVATE_BASE, "palera1n-main", "palera1n"),
        "desc": "Palera1n (Source Folder - Needs Compilation)",
        "args": ["-v"],
        "type": "source_check",  # Special check needed
        "sha256": None  # TODO: Add official SHA256 hash for compiled binary
    },
    "ira1n": {
        "path": os.path.join(PRIVATE_BASE, "ira1n", "iRa1n.exe"),
        "desc": "iRa1n Checkra1n Wrapper (Windows Only)",
        "args": [],
        "type": "win_exe",
        "sha256": None  # TODO: Add official SHA256 hash
    },
    "checkra1n": {
        "path": os.path.join(PRIVATE_BASE, "checkra1n"),
        "desc": "Checkra1n Jailbreak Tool",
        "args": ["-v"],
        "type": "bin",
        "sha256": None  # TODO: Add official SHA256 hash
    },
    "gaster": {
        "path": os.path.join(PRIVATE_BASE, "gaster"),
        "desc": "Gaster - checkm8-based DFU helper",
        "args": [],
        "type": "bin",
        "sha256": None  # TODO: Add official SHA256 hash
    },

    # --- ANDROID TOOLS ---
    "mtkclient": {
        "path": os.path.join(PRIVATE_BASE, "mtkclient", "mtk"),
        "desc": "MediaTek Boot/Flash Utility",
        "args": [],
        "type": "bin",
        "sha256": None  # TODO: Add official SHA256 hash
    },
    "heimdall": {
        "path": os.path.join(PRIVATE_BASE, "heimdall", "heimdall"),
        "desc": "Samsung Odin Alternative (Linux/Mac)",
        "args": ["detect"],
        "type": "bin",
        "sha256": None  # TODO: Add official SHA256 hash
    },

    # --- PACKAGES / ZIPS ---
    "supersu": {
        "path": os.path.join(PRIVATE_BASE, "UPDATE-SuperSU-v2.76-20160630161323.zip"),
        "desc": "Legacy SuperSU Root Zip (Flash via TWRP)",
        "args": [],
        "type": "file",
        "sha256": None  # TODO: Add official SHA256 hash
    },
    "blu_debloat": {
        "path": os.path.join(PRIVATE_BASE, "bluR1-MTK_BLU-debloat_v2.zip"),
        "desc": "MediaTek Debloat Script (Zip)",
        "args": [],
        "type": "file",
        "sha256": None  # TODO: Add official SHA256 hash
    }
}

# ---------------------------------------------------------
# HASH VERIFICATION
# ---------------------------------------------------------

def calculate_sha256(file_path: str) -> Optional[str]:
    """Calculate SHA256 hash of a file."""
    try:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            # Read file in chunks to handle large files
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except Exception as e:
        log(f"[ERROR] Failed to calculate hash for {file_path}: {e}")
        return None

def verify_tool_hash(tool_key: str) -> tuple[bool, Optional[str]]:
    """
    Verify the SHA256 hash of a tool.
    
    Returns:
        (is_valid, error_message)
        - is_valid: True if hash matches or no hash is configured
        - error_message: None if valid, otherwise error description
    """
    tool = TOOLS.get(tool_key)
    if not tool:
        return False, "Unknown tool"
    
    expected_hash = tool.get("sha256")
    
    # If no hash is configured, skip verification (but warn)
    if expected_hash is None:
        log(f"[WARNING] No SHA256 hash configured for {tool_key}. Skipping verification.")
        log(f"[WARNING] To add verification, run: shasum -a 256 {tool['path']}")
        return True, None  # Allow execution but warn
    
    path = tool["path"]
    
    # Skip hash verification for files (zips) that aren't executables
    if tool.get("type") == "file":
        return True, None
    
    if not os.path.exists(path):
        return False, "File not found"
    
    actual_hash = calculate_sha256(path)
    if actual_hash is None:
        return False, "Failed to calculate file hash"
    
    if actual_hash.lower() != expected_hash.lower():
        return False, (
            f"HASH MISMATCH!\n"
            f"  Expected: {expected_hash}\n"
            f"  Actual:   {actual_hash}\n"
            f"  File:     {path}\n"
            f"\n"
            f"SECURITY ALERT: This file does not match the expected hash.\n"
            f"The file may have been tampered with or is not the official version.\n"
            f"Execution has been BLOCKED for your safety."
        )
    
    log(f"[VERIFY] ✓ Hash verified for {tool_key}")
    return True, None

# ---------------------------------------------------------
# LOGIC
# ---------------------------------------------------------

def _check_binary(tool_key: str) -> bool:
    """Verifies existence and permissions."""
    tool = TOOLS.get(tool_key)
    if not tool:
        return False
    
    path = tool["path"]
    
    if not os.path.exists(path):
        # If it's the source check type, we expect the binary inside the folder
        if tool.get("type") == "source_check":
            # Check if they built it yet
            return os.path.exists(path)
        return False
    
    # Ensure executable if it's a binary/exploit
    if tool.get("type") in ["bin", "exploit"]:
        if not os.access(path, os.X_OK):
            try:
                os.chmod(path, 0o755)
            except Exception:
                pass
    
    return True

def run_tool(tool_key: str) -> None:
    """Orchestrates the execution with hash verification."""
    tool = TOOLS.get(tool_key)
    if not tool:
        print("[!] Unknown tool.")
        return

    print(f"\n=== EXEC: {tool_key.upper()} ===")
    print(f"Target: {tool['desc']}")
    print(f"Path:   {tool['path']}")

    # Validation - Check if file exists
    if not _check_binary(tool_key):
        print(f"✗ Binary not found.")
        
        if tool.get("type") == "source_check":
            print(f"  [!] This looks like source code. You need to compile it.")
            print(f"  1. Go to: {os.path.dirname(tool['path'])}")
            print(f"  2. Run: 'make'")
        elif tool.get("type") == "win_exe" and "windows" not in SYSTEM_OS:
            print(f"  [!] This is a Windows executable. It will not run on {SYSTEM_OS}.")
            print(f"  Try installing 'wine' to run it: `wine {tool['path']}`")
        else:
            print(f"  Please ensure the file is in: {PRIVATE_BASE}")
        
        input("  Press Enter to return...")
        return

    # HASH VERIFICATION - Critical security check
    print("\n[SECURITY] Verifying tool authenticity...")
    is_valid, error_msg = verify_tool_hash(tool_key)
    
    if not is_valid:
        print(f"\n✗✗✗ SECURITY CHECK FAILED ✗✗✗")
        print(f"\n{error_msg}")
        print(f"\n[ACTION REQUIRED]")
        print(f"  1. Re-download the tool from the official source")
        print(f"  2. Verify the hash matches: shasum -a 256 {tool['path']}")
        print(f"  3. Update the hash in trapdoor.py if using a different version")
        print(f"\nExecution BLOCKED for security reasons.")
        input("\n  Press Enter to return...")
        return

    # File Type Handling
    if tool.get("type") == "file":
        print(f"\n[INFO] This is a flashable zip/file.")
        print(f"You typically flash this using TWRP or 'adb sideload'.")
        print(f"Command: adb sideload {os.path.basename(tool['path'])}")
        q = input("Run 'adb sideload' now? (y/n): ").lower()
        if q == 'y':
            adb_path = TOOLS["adb"]["path"]
            if os.path.exists(adb_path):
                run_interactive([adb_path, "sideload", tool["path"]])
            else:
                print("✗ ADB binary not found to perform sideload.")
        return

    # Command Execution
    cmd = [tool["path"]] + tool["args"]
    
    print("\n[!] WARNING: You are running a private tool.")
    print(f"[!] Tool: {tool['desc']}")
    print(f"[!] Path: {tool['path']}")
    confirm = input("    Type 'RUN' to proceed: ").strip()
    
    if confirm == "RUN":
        if tool.get("type") == "win_exe" and "windows" not in SYSTEM_OS:
            # Try wine for .exe on linux/mac
            cmd = ["wine", tool["path"]]
        
        run_interactive(cmd)
    else:
        print("Aborted.")
    
    input("Press Enter to continue...")

def trapdoor_menu() -> None:
    """Trapdoor Main Menu."""
    while True:
        print("\n╔════════════════════════════════════════╗")
        print("║   TRAPDOOR - PRIVATE ARSENAL           ║")
        print(f"║   Dir: {os.path.basename(PRIVATE_BASE):<28}║")
        print("╚════════════════════════════════════════╝")
        
        print("\n[PLATFORM TOOLS]")
        _print_option("1", "adb")
        _print_option("2", "fastboot")
        
        print("\n[ROOT EXPLOITS]")
        _print_option("3", "dirtycow")
        _print_option("4", "recowvery")
        _print_option("5", "supersu")

        print("\n[JAILBREAK / UNLOCK]")
        _print_option("6", "palera1n")
        _print_option("7", "ira1n")
        _print_option("8", "checkra1n")
        _print_option("9", "gaster")

        print("\n[ANDROID TOOLS]")
        _print_option("a", "mtkclient")
        _print_option("b", "heimdall")
        _print_option("c", "blu_debloat")

        print("\n[0] Back")
        
        choice = input("\nSelect: ").strip().lower()
        
        map_choice = {
            "1": "adb", "2": "fastboot",
            "3": "dirtycow", "4": "recowvery", "5": "supersu",
            "6": "palera1n", "7": "ira1n", "8": "checkra1n", "9": "gaster",
            "a": "mtkclient", "b": "heimdall", "c": "blu_debloat"
        }
        
        if choice == "0":
            break
        elif choice in map_choice:
            run_tool(map_choice[choice])
        else:
            print("Invalid choice.")

def _print_option(key: str, tool_name: str) -> None:
    """Print a menu option with status indicator."""
    tool = TOOLS.get(tool_name)
    if not tool:
        print(f"  {key}. [✗] {tool_name} (not configured)")
        return
    
    exists = _check_binary(tool_name)
    has_hash = tool.get("sha256") is not None
    
    # Status indicators
    if not exists:
        status = "✗"
    elif tool.get("type") == "source_check" and not exists:
        status = "?"  # Source exists, binary might not
    elif has_hash:
        status = "✓"  # Verified
    else:
        status = "⚠"  # Exists but no hash configured
    
    hash_status = " [HASH]" if has_hash else " [NO HASH]"
    print(f"  {key}. [{status}] {tool['desc']}{hash_status}")
