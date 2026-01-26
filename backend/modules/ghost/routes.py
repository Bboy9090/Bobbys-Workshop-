"""
Ghost Codex API Routes
Metadata shredding, canary tokens, burner personas.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from typing import Optional
import uuid
import os
import json

from .shredder import shred_metadata
from .canary import generate_canary_token, check_canary_alert
from .persona import create_burner_persona

router = APIRouter()

# Storage directories
GHOST_DIR = os.path.join(os.path.dirname(__file__), "../../../ghost_data")
os.makedirs(GHOST_DIR, exist_ok=True)
ALERTS_DIR = os.path.join(GHOST_DIR, "alerts")
os.makedirs(ALERTS_DIR, exist_ok=True)
PERSONAS_PATH = os.path.join(GHOST_DIR, "personas.json")


def load_personas():
    """
    Load the saved burner personas from the personas JSON file.
    
    Returns:
        list: A list of persona objects loaded from PERSONAS_PATH; returns an empty list if the file does not exist, is empty, or cannot be read/parsed.
    """
    if not os.path.exists(PERSONAS_PATH):
        return []
    try:
        with open(PERSONAS_PATH, "r") as f:
            return json.load(f) or []
    except Exception:
        return []


def save_personas(personas):
    """
    Persist burner personas to the configured personas JSON file, overwriting any existing contents.
    
    Parameters:
        personas (list): List of persona objects (typically dicts) to write to PERSONAS_PATH as JSON.
    """
    with open(PERSONAS_PATH, "w") as f:
        json.dump(personas, f, indent=2)


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
    """
    Collects and returns all parsed canary alerts stored on disk.
    
    Reads every `.json` file in ALERTS_DIR, parses valid JSON alert objects, and returns them in the response under `data.alerts`. If the alerts directory cannot be read, returns a 500 response with error code `ALERTS_READ_FAILED`.
    
    Returns:
        JSONResponse: On success: `{"ok": True, "data": {"alerts": [...]}}`. On failure: `{"ok": False, "error": {"code": "ALERTS_READ_FAILED", "message": <error>}}`.
    """
    alerts = []
    try:
        for filename in os.listdir(ALERTS_DIR):
            if not filename.endswith(".json"):
                continue
            file_path = os.path.join(ALERTS_DIR, filename)
            try:
                with open(file_path, "r") as f:
                    alert = json.load(f)
                    alerts.append(alert)
            except Exception:
                continue
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "ALERTS_READ_FAILED", "message": str(e)}
            }
        )

    return JSONResponse({
        "ok": True,
        "data": {
            "alerts": alerts
        }
    })


@router.post("/persona/create")
async def create_persona(
    name: Optional[str] = None,
    email_domain: Optional[str] = None
):
    """
    Create and persist a new burner persona and return it in a JSON response.
    
    Parameters:
        name (Optional[str]): Optional display name or seed for the persona. If omitted, a name is generated.
        email_domain (Optional[str]): Optional email domain to use for the persona's address. If omitted, a default domain is chosen.
    
    Returns:
        JSONResponse: On success, returns {"ok": True, "data": persona} containing the created persona.
                      On failure, returns a 500 response {"ok": False, "error": {"code": "PERSONA_FAILED", "message": ...}}.
    """
    try:
        persona = create_burner_persona(name, email_domain)
        personas = load_personas()
        personas.insert(0, persona)
        save_personas(personas)

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
    personas = load_personas()
    return JSONResponse({
        "ok": True,
        "data": {
            "personas": personas
        }
    })