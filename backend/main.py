"""
Bobby's Workshop - FastAPI Backend
Secret Rooms backend for Sonic Codex, Ghost Codex, and Pandora Codex enhancements.
"""

from fastapi import FastAPI, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from typing import Optional
import uvicorn
import os

from modules.sonic import router as sonic_router
from modules.ghost import router as ghost_router
from modules.pandora import router as pandora_router

app = FastAPI(
    title="Bobby's Workshop Secret Rooms API",
    description="FastAPI backend for Sonic Codex, Ghost Codex, and Pandora Codex",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Secret Room authentication
SECRET_ROOM_PASSCODE = os.getenv("SECRET_ROOM_PASSCODE") or os.getenv("TRAPDOOR_PASSCODE")

def verify_secret_room_passcode(x_secret_room_passcode: Optional[str] = Header(None)):
    """Verify Secret Room passcode from header."""
    if not SECRET_ROOM_PASSCODE:
        raise HTTPException(
            status_code=503,
            detail="Secret Room passcode not configured"
        )
    
    if not x_secret_room_passcode or x_secret_room_passcode != SECRET_ROOM_PASSCODE:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing Secret Room passcode"
        )
    
    return True

# Mount routers with authentication
app.include_router(
    sonic_router,
    prefix="/api/v1/trapdoor/sonic",
    tags=["Sonic Codex"],
    dependencies=[Depends(verify_secret_room_passcode)]
)

app.include_router(
    ghost_router,
    prefix="/api/v1/trapdoor/ghost",
    tags=["Ghost Codex"],
    dependencies=[Depends(verify_secret_room_passcode)]
)

app.include_router(
    pandora_router,
    prefix="/api/v1/trapdoor/pandora",
    tags=["Pandora Codex"],
    dependencies=[Depends(verify_secret_room_passcode)]
)

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "service": "secret-rooms-backend"}

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Bobby's Workshop Secret Rooms Backend",
        "version": "1.0.0",
        "rooms": ["sonic", "ghost", "pandora"]
    }

if __name__ == "__main__":
    port = int(os.getenv("FASTAPI_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
