from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import our custom modules we just built
try:
    from .phoenix_integrator import PhoenixIntegrator
    from .security_overlay import ShadowRollbackEngine
except ImportError:
    from phoenix_integrator import PhoenixIntegrator
    from security_overlay import ShadowRollbackEngine

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
