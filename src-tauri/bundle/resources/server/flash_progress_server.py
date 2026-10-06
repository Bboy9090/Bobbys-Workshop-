from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import time
import uvicorn

app = FastAPI(title="BobFWTools Legacy Flash Compatibility Service")

class FlashJobRequest(BaseModel):
    deviceId: str
    deviceName: Optional[str] = None
    partition: str
    imageSize: int

@app.post("/api/flash/start")
async def start_flash(request: FlashJobRequest):
    return {
        "success": False,
        "error": "FLASH_BACKEND_UNAVAILABLE",
        "message": "Legacy Python flash execution is disabled. Use the BobFWTools native hardware-qualified executor.",
        "deviceId": request.deviceId,
        "timestamp": int(time.time() * 1000),
    }

@app.get("/api/flash/jobs")
async def get_jobs():
    return {"jobs": [], "source": "legacy-service-disabled"}

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "flashExecutionAvailable": False,
        "reason": "Legacy flash execution disabled by BobFWTools production policy",
        "timestamp": int(time.time() * 1000),
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
