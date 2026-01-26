"""
Ghost Codex API Routes
Metadata shredding, canary tokens, burner personas.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from typing import Optional
import uuid
import os

from .shredder import shred_metadata
from .canary import generate_canary_token, check_canary_alert
from .persona import create_burner_persona

router = APIRouter()

# Storage directories
GHOST_DIR = os.path.join(os.path.dirname(__file__), "../../../ghost_data")
os.makedirs(GHOST_DIR, exist_ok=True)


@router.post("/shred")
async def shred_file_metadata(
    file: UploadFile = File(...),
    preserve_structure: bool = True
):
    """Shred metadata from uploaded file."""
    try:
        # Save uploaded file
        file_id = str(uuid.uuid4())
        file_dir = os.path.join(GHOST_DIR, file_id)
        os.makedirs(file_dir, exist_ok=True)
        
        original_path = os.path.join(file_dir, f"original.{file.filename.split('.')[-1]}")
        with open(original_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Shred metadata
        clean_path = os.path.join(file_dir, f"clean_{file.filename}")
        success = shred_metadata(original_path, clean_path, preserve_structure)
        
        if not success:
            raise HTTPException(status_code=500, detail="Metadata shredding failed")
        
        return JSONResponse({
            "ok": True,
            "data": {
                "file_id": file_id,
                "original_filename": file.filename,
                "clean_filename": f"clean_{file.filename}",
                "download_url": f"/api/v1/trapdoor/ghost/download/{file_id}"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "SHRED_FAILED", "message": str(e)}
            }
        )


@router.post("/canary/generate")
async def generate_canary(
    file_type: str = "pdf",
    metadata: Optional[dict] = None
):
    """Generate a canary token file."""
    try:
        token_id = str(uuid.uuid4())
        canary_file = generate_canary_token(token_id, file_type, metadata or {})
        
        return JSONResponse({
            "ok": True,
            "data": {
                "token_id": token_id,
                "file_type": file_type,
                "download_url": f"/api/v1/trapdoor/ghost/canary/download/{token_id}",
                "alert_url": f"/api/v1/trapdoor/ghost/trap/{token_id}"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "CANARY_FAILED", "message": str(e)}
            }
        )


@router.get("/trap/{token_id}")
async def check_trap(token_id: str):
    """Check if canary token was triggered."""
    alert = check_canary_alert(token_id)
    
    if alert:
        return JSONResponse({
            "ok": True,
            "data": {
                "triggered": True,
                "alert": alert
            }
        })
    else:
        return JSONResponse({
            "ok": True,
            "data": {
                "triggered": False
            }
        })


@router.get("/alerts")
async def list_alerts():
    """List all canary token alerts."""
    # Placeholder - would read from database/storage
    return JSONResponse({
        "ok": True,
        "data": {
            "alerts": []
        }
    })


@router.post("/persona/create")
async def create_persona(
    name: Optional[str] = None,
    email_domain: Optional[str] = None
):
    """Create a burner persona."""
    try:
        persona = create_burner_persona(name, email_domain)
        
        return JSONResponse({
            "ok": True,
            "data": persona
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "PERSONA_FAILED", "message": str(e)}
            }
        )


@router.get("/personas")
async def list_personas():
    """List all burner personas."""
    # Placeholder
    return JSONResponse({
        "ok": True,
        "data": {
            "personas": []
        }
    })
