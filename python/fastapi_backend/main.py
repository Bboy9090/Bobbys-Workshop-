"""
FastAPI Backend for Secret Rooms
Sonic Codex, Ghost Codex, Pandora Codex
"""

from fastapi import FastAPI, Header, HTTPException, UploadFile, File, BackgroundTasks, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.docs import get_swagger_ui_html
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import uvicorn
import json
import uuid
import logging
import sys
from datetime import datetime
from pathlib import Path
import traceback
from contextlib import asynccontextmanager
import aiofiles
import shutil

# Import Codex modules
try:
    from modules import ghost_codex, sonic_codex, pandora_codex
    MODULES_AVAILABLE = True
except ImportError as e:
    MODULES_AVAILABLE = False
    IMPORT_ERROR = str(e)

# Configure structured logging
LOG_DIR = Path(os.getenv("FASTAPI_LOG_DIR", "./logs"))
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / "fastapi.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Production configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for startup and shutdown"""
    # Startup
    logger.info("=" * 60)
    logger.info("🚀 Bobby's Secret Rooms FastAPI Backend Starting")
    logger.info(f"Environment: {ENVIRONMENT}")
    logger.info(f"Modules Available: {MODULES_AVAILABLE}")
    if not MODULES_AVAILABLE:
        logger.warning(f"⚠️  Module import error: {IMPORT_ERROR}")
    logger.info(f"Data Directories: {[str(d) for d in [JOBS_DIR, PERSONAS_DIR, CANARY_DIR, UPLOAD_DIR, SHREAD_DIR]]}")
    logger.info("=" * 60)
    yield
    # Shutdown
    logger.info("=" * 60)
    logger.info("🛑 Bobby's Secret Rooms FastAPI Backend Shutting Down")
    logger.info("=" * 60)

app = FastAPI(
    title="Bobby's Secret Rooms FastAPI Backend",
    version="1.0.0",
    description="FastAPI backend for Sonic Codex, Ghost Codex, and Pandora Codex services",
    lifespan=lifespan,
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Enhanced HTTP exception handler with logging"""
    error_id = f"ERR-{uuid.uuid4().hex[:8].upper()}"
    logger.error(f"[{error_id}] HTTP {exc.status_code}: {exc.detail} | Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "ok": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
                "errorId": error_id
            },
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Enhanced validation exception handler"""
    error_id = f"VAL-{uuid.uuid4().hex[:8].upper()}"
    logger.warning(f"[{error_id}] Validation error: {exc.errors()} | Path: {request.url.path}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "ok": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": exc.errors(),
                "errorId": error_id
            },
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unexpected errors"""
    error_id = f"UNK-{uuid.uuid4().hex[:8].upper()}"
    error_traceback = traceback.format_exc()
    logger.error(f"[{error_id}] Unexpected error: {str(exc)}")
    logger.error(f"[{error_id}] Traceback: {error_traceback}")
    logger.error(f"[{error_id}] Path: {request.url.path}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "ok": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred" if ENVIRONMENT == "production" else str(exc),
                "errorId": error_id,
                **({"traceback": error_traceback} if ENVIRONMENT != "production" else {})
            },
            "timestamp": datetime.now().isoformat()
        }
    )

# Secret Room Passcode
SECRET_ROOM_PASSCODE = os.getenv("SECRET_ROOM_PASSCODE", "BJ0990")

# Data directories
JOBS_DIR = Path("./jobs")
PERSONAS_DIR = Path("./personas")
CANARY_DIR = Path("./canary_tokens")
UPLOAD_DIR = Path("./uploads")
SHREAD_DIR = Path("./shreaded")
JOBS_DIR.mkdir(exist_ok=True)
PERSONAS_DIR.mkdir(exist_ok=True)
CANARY_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)
SHREAD_DIR.mkdir(exist_ok=True)

def verify_passcode(x_secret_room_passcode: Optional[str] = Header(None)):
    """Verify Secret Room passcode"""
    if not x_secret_room_passcode or x_secret_room_passcode != SECRET_ROOM_PASSCODE:
        logger.warning(f"Invalid passcode attempt from {x_secret_room_passcode[:3] if x_secret_room_passcode else 'None'}...")
        raise HTTPException(
            status_code=401,
            detail="Invalid Secret Room passcode"
        )
    return True

# Health check endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "ok": True,
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "environment": ENVIRONMENT,
        "modules": {
            "available": MODULES_AVAILABLE,
            "ghost_codex": MODULES_AVAILABLE and hasattr(ghost_codex, "shred_metadata") if MODULES_AVAILABLE else False,
            "sonic_codex": MODULES_AVAILABLE and hasattr(sonic_codex, "transcribe_audio") if MODULES_AVAILABLE else False,
            "pandora_codex": MODULES_AVAILABLE and hasattr(pandora_codex, "detect_ios_devices") if MODULES_AVAILABLE else False
        }
    }

@app.get("/api/v1/status")
async def api_status():
    """API status endpoint"""
    return {
        "ok": True,
        "service": "Bobby's Secret Rooms FastAPI Backend",
        "version": "1.0.0",
        "environment": ENVIRONMENT,
        "modules_available": MODULES_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }

# ==================== SONIC CODEX ====================

@app.get("/api/v1/trapdoor/sonic")
async def sonic_info(x_secret_room_passcode: Optional[str] = Header(None)):
    verify_passcode(x_secret_room_passcode)
    return {
        "ok": True,
        "name": "Sonic Codex",
        "description": "Audio processing and transcription suite",
        "status": "available",
        "backend": "FastAPI"
    }

class CaptureRequest(BaseModel):
    duration: Optional[int] = 60
    source: Optional[str] = "live"  # live, file, url
    file_path: Optional[str] = None
    url: Optional[str] = None

@app.post("/api/v1/trapdoor/sonic/capture/start")
async def sonic_capture_start(
    request: CaptureRequest,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    # Generate job ID
    job_id = f"sonic-{uuid.uuid4().hex[:12]}"
    job_file = JOBS_DIR / f"{job_id}.json"
    
    # Create job record
    job_data = {
        "jobId": job_id,
        "status": "pending",
        "source": request.source,
        "duration": request.duration,
        "createdAt": datetime.now().isoformat(),
        "result": None,
        "error": None
    }
    
    # Save job
    with open(job_file, 'w') as f:
        json.dump(job_data, f, indent=2)
    
    # TODO: Start actual audio capture/transcription in background
    # For now, simulate completion
    job_data["status"] = "processing"
    with open(job_file, 'w') as f:
        json.dump(job_data, f, indent=2)
    
    return {
        "ok": True,
        "data": {
            "jobId": job_id,
            "status": "processing",
            "message": "Audio capture job created"
        }
    }

@app.get("/api/v1/trapdoor/sonic/jobs")
async def sonic_jobs(x_secret_room_passcode: Optional[str] = Header(None)):
    verify_passcode(x_secret_room_passcode)
    
    jobs = []
    for job_file in JOBS_DIR.glob("sonic-*.json"):
        try:
            with open(job_file, 'r') as f:
                job_data = json.load(f)
                jobs.append({
                    "jobId": job_data.get("jobId"),
                    "status": job_data.get("status"),
                    "createdAt": job_data.get("createdAt"),
                    "source": job_data.get("source")
                })
        except:
            continue
    
    # Sort by creation time (newest first)
    jobs.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    
    return {
        "ok": True,
        "data": {
            "jobs": jobs
        }
    }

@app.get("/api/v1/trapdoor/sonic/jobs/{job_id}")
async def sonic_job_details(
    job_id: str,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    job_file = JOBS_DIR / f"{job_id}.json"
    if not job_file.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    
    with open(job_file, 'r') as f:
        job_data = json.load(f)
    
    return {
        "ok": True,
        "data": {
            "jobId": job_data.get("jobId"),
            "status": job_data.get("status"),
            "createdAt": job_data.get("createdAt"),
            "result": job_data.get("result"),
            "error": job_data.get("error")
        }
    }

@app.post("/api/v1/trapdoor/sonic/upload")
async def sonic_upload(
    file: UploadFile = File(...),
    x_secret_room_passcode: Optional[str] = Header(None)
):
    """Upload audio file for processing"""
    verify_passcode(x_secret_room_passcode)
    
    try:
        # Generate job ID
        job_id = f"sonic-{uuid.uuid4().hex[:12]}"
        job_file = JOBS_DIR / f"{job_id}.json"
        
        # Save uploaded file
        file_extension = Path(file.filename).suffix
        saved_file_path = UPLOAD_DIR / f"{job_id}{file_extension}"
        
        async with aiofiles.open(saved_file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Create job record
        job_data = {
            "jobId": job_id,
            "status": "pending",
            "source": "file",
            "filename": file.filename,
            "file_path": str(saved_file_path),
            "createdAt": datetime.now().isoformat(),
            "result": None,
            "error": None
        }
        
        # Process audio if modules available
        if MODULES_AVAILABLE:
            try:
                result = sonic_codex.process_audio_job(job_id, "file", None, saved_file_path)
                job_data.update(result)
            except Exception as e:
                job_data["status"] = "failed"
                job_data["error"] = str(e)
                logger.error(f"Audio processing failed: {e}")
        else:
            job_data["status"] = "pending"
            job_data["error"] = "Audio processing modules not available. Install Whisper: pip install openai-whisper"
        
        # Save job
        with open(job_file, 'w') as f:
            json.dump(job_data, f, indent=2)
        
        return {
            "ok": True,
            "data": {
                "jobId": job_id,
                "status": job_data["status"],
                "message": "File uploaded successfully",
                "filename": file.filename
            }
        }
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/api/v1/trapdoor/sonic/jobs/{job_id}/download")
async def sonic_job_download(
    job_id: str,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    job_file = JOBS_DIR / f"{job_id}.json"
    if not job_file.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    
    with open(job_file, 'r') as f:
        job_data = json.load(f)
    
    # Return file if available
    if job_data.get("file_path") and Path(job_data["file_path"]).exists():
        return FileResponse(
            job_data["file_path"],
            media_type="application/octet-stream",
            filename=Path(job_data["file_path"]).name
        )
    
    raise HTTPException(status_code=404, detail="File not found")

# ==================== GHOST CODEX ====================

@app.get("/api/v1/trapdoor/ghost")
async def ghost_info(x_secret_room_passcode: Optional[str] = Header(None)):
    verify_passcode(x_secret_room_passcode)
    return {
        "ok": True,
        "name": "Ghost Codex",
        "description": "Metadata shredding and privacy tools",
        "status": "available",
        "backend": "FastAPI"
    }

class CanaryRequest(BaseModel):
    tokenType: str = "file"  # file, email, url, webhook
    name: Optional[str] = None

@app.post("/api/v1/trapdoor/ghost/canary/generate")
async def ghost_canary_generate(
    request: CanaryRequest,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    if MODULES_AVAILABLE:
        # Use module function
        token_data = ghost_codex.generate_canary_token(request.tokenType, request.name)
        token_id = token_data["tokenId"]
        token_file = CANARY_DIR / f"{token_id}.json"
        
        # Save token
        with open(token_file, 'w') as f:
            json.dump(token_data, f, indent=2)
        
        return {
            "ok": True,
            "data": {
                "tokenId": token_id,
                "tokenType": request.tokenType,
                "metadata": token_data["metadata"]
            }
        }
    else:
        # Fallback to simple implementation
        token_id = f"canary-{uuid.uuid4().hex[:12]}"
        token_file = CANARY_DIR / f"{token_id}.json"
        token_data = {
            "tokenId": token_id,
            "tokenType": request.tokenType,
            "name": request.name or f"Canary Token {token_id[:8]}",
            "createdAt": datetime.now().isoformat(),
            "triggered": False,
            "triggeredAt": None,
            "metadata": {
                "filename": f"{token_id}.html" if request.tokenType == "file" else None,
                "email": f"{token_id}@canary.example.com" if request.tokenType == "email" else None,
                "url": f"https://canary.example.com/{token_id}" if request.tokenType == "url" else None
            }
        }
        with open(token_file, 'w') as f:
            json.dump(token_data, f, indent=2)
        return {
            "ok": True,
            "data": {
                "tokenId": token_id,
                "tokenType": request.tokenType,
                "metadata": token_data["metadata"]
            }
        }

@app.get("/api/v1/trapdoor/ghost/trap/{token_id}")
async def ghost_trap_check(
    token_id: str,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    token_file = CANARY_DIR / f"{token_id}.json"
    if not token_file.exists():
        raise HTTPException(status_code=404, detail="Token not found")
    
    with open(token_file, 'r') as f:
        token_data = json.load(f)
    
    return {
        "ok": True,
        "data": {
            "tokenId": token_data.get("tokenId"),
            "triggered": token_data.get("triggered", False),
            "triggeredAt": token_data.get("triggeredAt")
        }
    }

@app.get("/api/v1/trapdoor/ghost/alerts")
async def ghost_alerts(x_secret_room_passcode: Optional[str] = Header(None)):
    verify_passcode(x_secret_room_passcode)
    
    alerts = []
    for token_file in CANARY_DIR.glob("canary-*.json"):
        try:
            with open(token_file, 'r') as f:
                token_data = json.load(f)
                if token_data.get("triggered"):
                    alerts.append({
                        "tokenId": token_data.get("tokenId"),
                        "tokenType": token_data.get("tokenType"),
                        "triggeredAt": token_data.get("triggeredAt"),
                        "name": token_data.get("name")
                    })
        except:
            continue
    
    alerts.sort(key=lambda x: x.get("triggeredAt", ""), reverse=True)
    
    return {
        "ok": True,
        "data": {
            "alerts": alerts
        }
    }

class PersonaRequest(BaseModel):
    personaType: str = "basic"  # basic, professional, burner
    name: Optional[str] = None

@app.post("/api/v1/trapdoor/ghost/persona/create")
async def ghost_persona_create(
    request: PersonaRequest,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    if MODULES_AVAILABLE:
        # Use module function
        persona = ghost_codex.create_persona(request.personaType, request.name)
        persona_id = persona["personaId"]
        persona_file = PERSONAS_DIR / f"{persona_id}.json"
        
        # Save persona
        with open(persona_file, 'w') as f:
            json.dump(persona, f, indent=2)
        
        return {
            "ok": True,
            "data": {
                "personaId": persona_id,
                "persona": persona
            }
        }
    else:
        # Fallback to simple implementation
        import random
        persona_id = f"persona-{uuid.uuid4().hex[:12]}"
        persona_file = PERSONAS_DIR / f"{persona_id}.json"
        first_names = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia"]
        persona = {
            "personaId": persona_id,
            "personaType": request.personaType,
            "name": request.name or f"{random.choice(first_names)} {random.choice(last_names)}",
            "email": f"{persona_id[:8]}@burner.example.com",
            "phone": f"+1{random.randint(2000000000, 9999999999)}",
            "createdAt": datetime.now().isoformat(),
            "metadata": {}
        }
        with open(persona_file, 'w') as f:
            json.dump(persona, f, indent=2)
        return {
            "ok": True,
            "data": {
                "personaId": persona_id,
                "persona": persona
            }
        }

@app.get("/api/v1/trapdoor/ghost/personas")
async def ghost_personas(x_secret_room_passcode: Optional[str] = Header(None)):
    verify_passcode(x_secret_room_passcode)
    
    personas = []
    for persona_file in PERSONAS_DIR.glob("persona-*.json"):
        try:
            with open(persona_file, 'r') as f:
                persona_data = json.load(f)
                personas.append({
                    "personaId": persona_data.get("personaId"),
                    "name": persona_data.get("name"),
                    "email": persona_data.get("email"),
                    "personaType": persona_data.get("personaType"),
                    "createdAt": persona_data.get("createdAt")
                })
        except:
            continue
    
    personas.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    
    return {
        "ok": True,
        "data": {
            "personas": personas
        }
    }

@app.post("/api/v1/trapdoor/ghost/shred")
async def ghost_shred(
    file: UploadFile = File(...),
    x_secret_room_passcode: Optional[str] = Header(None)
):
    """Shred metadata from uploaded file"""
    verify_passcode(x_secret_room_passcode)
    
    if not MODULES_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Ghost Codex modules not available. Please install dependencies: pip install Pillow exifread"
        )
    
    try:
        # Save uploaded file
        file_id = f"file-{uuid.uuid4().hex[:12]}"
        file_extension = Path(file.filename).suffix
        saved_file_path = UPLOAD_DIR / f"{file_id}{file_extension}"
        
        async with aiofiles.open(saved_file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Shred metadata
        try:
            result = ghost_codex.shred_metadata(saved_file_path)
            output_path = Path(result["cleaned_file"])
            
            # Return cleaned file
            if output_path.exists():
                return FileResponse(
                    output_path,
                    media_type="application/octet-stream",
                    filename=f"{Path(file.filename).stem}_cleaned{file_extension}"
                )
            else:
                raise HTTPException(status_code=500, detail="Failed to create cleaned file")
        except ImportError as e:
            raise HTTPException(status_code=503, detail=str(e))
        except Exception as e:
            logger.error(f"Metadata shredding failed: {e}")
            raise HTTPException(status_code=500, detail=f"Shredding failed: {str(e)}")
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/v1/trapdoor/ghost/extract")
async def ghost_extract(
    file: UploadFile = File(...),
    x_secret_room_passcode: Optional[str] = Header(None)
):
    """Extract metadata from uploaded file"""
    verify_passcode(x_secret_room_passcode)
    
    if not MODULES_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Ghost Codex modules not available. Please install dependencies: pip install Pillow exifread"
        )
    
    try:
        # Save uploaded file temporarily
        file_id = f"file-{uuid.uuid4().hex[:12]}"
        file_extension = Path(file.filename).suffix
        saved_file_path = UPLOAD_DIR / f"{file_id}{file_extension}"
        
        async with aiofiles.open(saved_file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Extract metadata
        try:
            metadata = ghost_codex.extract_metadata(saved_file_path)
            
            # Clean up temporary file
            try:
                saved_file_path.unlink()
            except:
                pass
            
            return {
                "ok": True,
                "data": {
                    "filename": file.filename,
                    "metadata": metadata
                }
            }
        except Exception as e:
            logger.error(f"Metadata extraction failed: {e}")
            raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# ==================== PANDORA CODEX ====================

@app.get("/api/v1/trapdoor/pandora")
async def pandora_info(x_secret_room_passcode: Optional[str] = Header(None)):
    verify_passcode(x_secret_room_passcode)
    return {
        "ok": True,
        "name": "Pandora Codex",
        "description": "Hardware manipulation and Chain-Breaker",
        "status": "available",
        "backend": "FastAPI"
    }

class ChainBreakerRequest(BaseModel):
    deviceSerial: str
    deviceType: Optional[str] = "auto-detect"
    operation: str = "activation_bypass"  # activation_bypass, signal_bypass

@app.post("/api/v1/trapdoor/pandora/chainbreaker")
async def pandora_chainbreaker(
    request: ChainBreakerRequest,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    # TODO: Implement actual Chain-Breaker logic
    # This would interface with checkm8, SSHRD, or activation bypass tools
    
    return {
        "ok": True,
        "data": {
            "message": "Chain-Breaker operation initiated",
            "deviceSerial": request.deviceSerial,
            "operation": request.operation,
            "status": "pending",
            "estimatedTime": "5-15 minutes"
        }
    }

class DFUDetectRequest(BaseModel):
    deviceSerial: Optional[str] = "auto"

@app.post("/api/v1/trapdoor/pandora/dfu/detect")
async def pandora_dfu_detect(
    request: DFUDetectRequest,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    if MODULES_AVAILABLE:
        # Compliance: DFU detection requires user-initiated action
        result = pandora_codex.detect_dfu_mode(
            device_serial=request.deviceSerial,
            user_initiated=True  # Always require user initiation
        )
        return {
            "ok": True,
            "data": result
        }
    else:
        return {
            "ok": True,
            "data": {
                "dfuMode": False,
                "deviceSerial": request.deviceSerial,
                "message": "DFU detection requires libimobiledevice. Install system tools first."
            }
        }

@app.post("/api/v1/trapdoor/pandora/dfu/enter")
async def pandora_dfu_enter(
    data: dict,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    # TODO: Implement DFU entry
    return {
        "ok": True,
        "message": "DFU entry initiated"
    }

@app.get("/api/v1/trapdoor/pandora/devices")
async def pandora_devices(
    user_initiated: bool = True,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    """
    Detect iOS devices (user-initiated scan only)
    
    Compliance: Requires explicit user action - no auto-scanning
    """
    verify_passcode(x_secret_room_passcode)
    
    if MODULES_AVAILABLE:
        result = pandora_codex.detect_ios_devices(user_initiated=user_initiated)
        return {
            "ok": True,
            "data": result
        }
    else:
        return {
            "ok": False,
            "error": "iOS device detection requires libimobiledevice. Install system tools first.",
            "data": {
                "devices": [],
                "tools_required": ["libimobiledevice"]
            }
        }

@app.post("/api/v1/trapdoor/pandora/manipulate")
async def pandora_manipulate(
    data: dict,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    # TODO: Implement hardware manipulation
    return {
        "ok": True,
        "message": "Hardware manipulation initiated"
    }

class JailbreakRequest(BaseModel):
    deviceSerial: str
    deviceType: str = "iPhone"
    iosVersion: Optional[str] = "auto-detect"
    method: str = "auto-select"  # checkra1n, palera1n, dopamine, misaka26

@app.post("/api/v1/trapdoor/pandora/jailbreak/execute")
async def pandora_jailbreak_execute(
    request: JailbreakRequest,
    x_secret_room_passcode: Optional[str] = Header(None)
):
    verify_passcode(x_secret_room_passcode)
    
    if MODULES_AVAILABLE:
        result = pandora_codex.execute_jailbreak(request.deviceSerial, request.method, request.iosVersion)
        return {
            "ok": True,
            "data": result
        }
    else:
        return {
            "ok": True,
            "data": {
                "message": "Jailbreak operation initiated",
                "deviceSerial": request.deviceSerial,
                "method": request.method,
                "status": "pending",
                "estimatedTime": "2-10 minutes",
                "note": "Full jailbreak implementation requires system tools (checkra1n, palera1n, etc.)"
            }
        }

@app.get("/api/v1/trapdoor/pandora/jailbreak/methods")
async def pandora_jailbreak_methods(x_secret_room_passcode: Optional[str] = Header(None)):
    verify_passcode(x_secret_room_passcode)
    
    if MODULES_AVAILABLE:
        methods = pandora_codex.get_jailbreak_methods()
        return {
            "ok": True,
            "methods": methods
        }
    else:
        return {
            "ok": True,
            "methods": [
                {"id": "checkra1n", "name": "Checkra1n", "devices": "A11 and below", "iosVersions": "iOS 12-15"},
                {"id": "palera1n", "name": "Palera1n", "devices": "A11 and below", "iosVersions": "iOS 15-17"},
                {"id": "dopamine", "name": "Dopamine", "devices": "A12-A17", "iosVersions": "iOS 15-17"},
                {"id": "misaka26", "name": "Misaka26", "devices": "A18+", "iosVersions": "iOS 18+"}
            ]
        }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
