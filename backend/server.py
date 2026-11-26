import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import all custom engines
try:
    from phoenix_integrator import PhoenixIntegrator
    from security_overlay import ShadowRollbackEngine
    from qualcomm_auth import QualcommAuthSpoofer, QualcommVaultError
    from mtk_v3_engine import MTKGlitchEngine
    from apple_engine import AppleSiliconEngine
    from wearables_engine import WearablesEngine
    from gaming_engine import GamingHandheldEngine
except ImportError:
    from .phoenix_integrator import PhoenixIntegrator
    from .security_overlay import ShadowRollbackEngine
    from .qualcomm_auth import QualcommAuthSpoofer, QualcommVaultError
    from .mtk_v3_engine import MTKGlitchEngine
    from .apple_engine import AppleSiliconEngine
    from .wearables_engine import WearablesEngine
    from .gaming_engine import GamingHandheldEngine

app = FastAPI(title="Phoenix Forge API", version="5.0.0")

# SECURITY NOTE: every endpoint in this file can trigger a real exploit or
# flash operation against physically-connected hardware (Qualcomm/MTK/Apple
# bypass, gaming-handheld RCM/BIOS flash). This used to have no authentication
# at all plus allow_origins=["*"] combined with allow_credentials=True -- any
# page loaded in any browser on the machine (or, if the process were ever
# bound to a non-loopback address, any host on the network) could call these
# endpoints. It now reuses this repo's existing Secret Room passcode
# convention (SECRET_ROOM_PASSCODE / TRAPDOOR_PASSCODE, already used by the
# Express trapdoor-auth middleware) and requires it on every exploit/flash
# endpoint via the X-Secret-Room-Passcode header.
_DEV_ORIGINS = [
    "http://localhost:1420",   # Tauri dev server default
    "http://127.0.0.1:1420",
    "http://localhost:5173",   # Vite dev server default
    "http://127.0.0.1:5173",
    "tauri://localhost",       # packaged Tauri webview origin
]
_extra_origins = os.environ.get("PHOENIX_FORGE_ALLOWED_ORIGINS", "")
allowed_origins = _DEV_ORIGINS + [o.strip() for o in _extra_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _required_passcode() -> str | None:
    return os.environ.get("SECRET_ROOM_PASSCODE") or os.environ.get("TRAPDOOR_PASSCODE")


async def require_secret_room_passcode(
    x_secret_room_passcode: str | None = Header(default=None),
) -> bool:
    """Gate for every exploit/flash endpoint below.

    Fails CLOSED: if no passcode is configured in the environment, every
    request is rejected (503) rather than silently allowed through -- this
    backend does not ship with a default/bypassable passcode.
    """
    required = _required_passcode()
    if not required:
        raise HTTPException(
            status_code=503,
            detail="Secret Room passcode not configured (set SECRET_ROOM_PASSCODE).",
        )
    if not x_secret_room_passcode or not hmac.compare_digest(x_secret_room_passcode, required):
        raise HTTPException(status_code=401, detail="Invalid or missing Secret Room passcode.")
    return True

# Initialize our core engines
forge_engine = PhoenixIntegrator(is_cloud_env=True)
security_engine = ShadowRollbackEngine()
wearables_engine_instance = WearablesEngine()
gaming_engine_instance = GamingHandheldEngine()

# --- Request Models ---
class RollbackRequest(BaseModel):
    device_id: str
    partitions: list[str] = ["efs", "nvram"]

class AuthRequest(BaseModel):
    device_id: str
    oem_target: str = "generic"

class AppleExecutionRequest(BaseModel):
    device_id: str
    vector: str # "checkm8" or "usbmuxd"
    pairing_record: str = "generic"

class WearableExecutionRequest(BaseModel):
    device_id: str = None
    target_ip: str = None
    vector: str # "ibus" or "wireless_adb"

class GamingExecutionRequest(BaseModel):
    device_id: str
    target: str # "switch" or "steam_deck"
    payload: str = "default.bin"

# --- API Endpoints ---

@app.get("/api/system/status")
async def get_system_status():
    """Basic health check for the React dashboard to ping."""
    return {"status": "online", "mode": "Bobbys Workshop Powered by Phoenix Forge"}

@app.get("/api/devices/scan")
async def scan_hardware(_auth: bool = Depends(require_secret_room_passcode)):
    """Triggers the Rust FFI to scan USB ports and route logic."""
    try:
        devices = forge_engine.scan_and_route()
        return {"status": "success", "device_count": len(devices), "devices": devices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/security/rollback")
async def execute_shadow_rollback(request: RollbackRequest, _auth: bool = Depends(require_secret_room_passcode)):
    """Executes the mandatory backup before allowing flash operations."""
    try:
        receipts = security_engine.execute_pre_flight_backup(
            device_id=request.device_id, 
            partitions=request.partitions
        )
        return {
            "status": "secure", 
            "message": "Shadow Rollback verified. Write access granted.",
            "receipts": receipts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rollback failed: {str(e)}")

@app.post("/api/security/authorize")
async def execute_oem_auth(request: AuthRequest, _auth: bool = Depends(require_secret_room_passcode)):
    """Hits the Cloud Vault to spoof the OEM RSA-3072 signature."""
    try:
        spoofer = QualcommAuthSpoofer(request.device_id, request.oem_target)
        success = spoofer.execute_authorized_handshake()
        return {"status": "authorized", "message": "OEM Signature spoofed. Silicon unlocked."}
    except QualcommVaultError as e:
        # The vault explicitly rejected the request or could not be reached --
        # this is a real failure, not a fallback-to-success case.
        raise HTTPException(status_code=403, detail=f"Cloud Vault authorization failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth Sequence Failed: {str(e)}")

@app.post("/api/execution/mtk-glitch")
async def execute_mtk_glitch(request: RollbackRequest, _auth: bool = Depends(require_secret_room_passcode)):
    """Bypasses MediaTek SLA/DAA via a TOCTOU USB glitch."""
    try:
        engine = MTKGlitchEngine(request.device_id)
        success = engine.run_master_sequence()
        if success:
            return {"status": "unlocked", "message": "MTK BootROM Glitched. DA Injected."}
        else:
            raise HTTPException(status_code=500, detail="Glitch sequence failed.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Glitch execution fatal: {str(e)}")

@app.post("/api/execution/apple-exploit")
async def execute_apple_exploit(request: AppleExecutionRequest, _auth: bool = Depends(require_secret_room_passcode)):
    """Targeted Apple silicon exploitation (Checkm8 or USBMuxd)."""
    try:
        engine = AppleSiliconEngine(request.device_id)
        if request.vector == "checkm8":
            success = engine.execute_checkm8_exploit()
        else:
            success = engine.establish_lockdownd_tunnel(request.pairing_record)
            
        if success:
            return {"status": "unlocked", "message": f"Apple Silicon Vector {request.vector.upper()} Executed."}
        else:
            raise HTTPException(status_code=500, detail="Exploit failed.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fatal Apple Exploit error: {str(e)}")

@app.post("/api/execution/wearable-exploit")
async def execute_wearable_exploit(request: WearableExecutionRequest, _auth: bool = Depends(require_secret_room_passcode)):
    """Exploitation and diagnosis for wearables."""
    try:
        if request.vector == "ibus":
            success = wearables_engine_instance.execute_ibus_dfu_restore(request.device_id)
        else:
            success = wearables_engine_instance.execute_wireless_adb_hijack(request.target_ip)
            
        if success:
            return {"status": "unlocked", "message": f"Wearable Vector {request.vector.upper()} Initialized."}
        else:
            raise HTTPException(status_code=500, detail="Exploit failed.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fatal Wearable Exploit error: {str(e)}")

@app.post("/api/execution/gaming-exploit")
async def execute_gaming_exploit(request: GamingExecutionRequest, _auth: bool = Depends(require_secret_room_passcode)):
    """Exploitation and recovery for gaming handhelds (Switch RCM or BIOS Recovery)."""
    try:
        if request.target == "switch":
            success = gaming_engine_instance.execute_tegra_rcm_smash(request.payload)
        else:
            success = gaming_engine_instance.execute_uefi_bios_flash(request.target, request.payload)
            
        if success:
            return {"status": "unlocked", "message": f"Gaming Sector {request.target.upper()} Execution Successful."}
        else:
            raise HTTPException(status_code=500, detail="Gaming exploit/recovery failed.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fatal Gaming Exploit error: {str(e)}")

if __name__ == "__main__":
    # Bind to loopback by default. Set PHOENIX_FORGE_HOST explicitly if this
    # ever needs to be reachable from another machine (e.g. a shop network) --
    # that should be a deliberate choice, not the default, given every
    # endpoint here can trigger a real exploit/flash against connected hardware.
    bind_host = os.environ.get("PHOENIX_FORGE_HOST", "127.0.0.1")
    bind_port = int(os.environ.get("FASTAPI_PORT", "8000"))
    uvicorn.run(app, host=bind_host, port=bind_port)
