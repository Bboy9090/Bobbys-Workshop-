from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import our custom modules we just built
try:
    from phoenix_integrator import PhoenixIntegrator
    from security_overlay import ShadowRollbackEngine
    from qualcomm_auth import QualcommAuthSpoofer
    from mtk_v3_engine import MTKGlitchEngine
except ImportError:
    from .phoenix_integrator import PhoenixIntegrator
    from .security_overlay import ShadowRollbackEngine
    from .qualcomm_auth import QualcommAuthSpoofer
    from .mtk_v3_engine import MTKGlitchEngine

app = FastAPI(title="Phoenix Forge API", version="1.0.0")

# Allow the React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize our core engines
# True = Cloud/Mock mode. False = Production/Real Hardware mode
forge_engine = PhoenixIntegrator(is_cloud_env=True)
security_engine = ShadowRollbackEngine()

# --- Request Models ---
class RollbackRequest(BaseModel):
    device_id: str
    partitions: list[str] = ["efs", "nvram"]

class AuthRequest(BaseModel):
    device_id: str
    oem_target: str = "generic"

# --- API Endpoints ---

@app.get("/api/system/status")
async def get_system_status():
    """Basic health check for the React dashboard to ping."""
    return {"status": "online", "mode": "Enterprise Diagnostics Active"}

@app.get("/api/devices/scan")
async def scan_hardware():
    """Triggers the Rust FFI to scan USB ports and route logic."""
    try:
        devices = forge_engine.scan_and_route()
        return {"status": "success", "device_count": len(devices), "devices": devices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/security/rollback")
async def execute_shadow_rollback(request: RollbackRequest):
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
async def execute_oem_auth(request: AuthRequest):
    """Hits the Cloud Vault to spoof the OEM RSA-3072 signature."""
    try:
        spoofer = QualcommAuthSpoofer(request.device_id, request.oem_target)
        success = spoofer.execute_authorized_handshake()
        
        if success:
            return {"status": "authorized", "message": "OEM Signature spoofed. Silicon unlocked."}
        else:
            raise HTTPException(status_code=403, detail="Cloud Vault rejected authorization.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth Sequence Failed: {str(e)}")

@app.post("/api/execution/mtk-glitch")
async def execute_mtk_glitch(request: RollbackRequest):
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
