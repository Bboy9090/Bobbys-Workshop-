"""
Sonic Codex API Routes
Audio capture, enhancement, transcription, and export.
"""

from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from typing import Optional
import uuid
import os
import asyncio

from .job_manager import JobManager
from .capture import AudioCapture
from .upload import handle_file_upload
from .extractor import extract_audio_from_video, extract_audio_from_url
from .enhancement.preprocess import preprocess_audio
from .enhancement.consonant_boost import apply_consonant_boost
from .transcription.whisper_engine import transcribe_audio
from .transcription.diarization import diarize_speakers
from .exporter import create_forensic_package
from .pipeline import get_pipeline

router = APIRouter()
job_manager = JobManager()

# Ensure jobs directory exists
JOBS_DIR = os.path.join(os.path.dirname(__file__), "../../../jobs")
os.makedirs(JOBS_DIR, exist_ok=True)


@router.post("/upload")
async def upload_audio(
    file: UploadFile = File(...),
    enhancement_preset: Optional[str] = "forensic"
):
    """Upload audio/video file for processing."""
    job_id = str(uuid.uuid4())
    
    try:
        # Save uploaded file
        job_dir = os.path.join(JOBS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        file_path = os.path.join(job_dir, f"original.{file.filename.split('.')[-1]}")
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Create job
        job = job_manager.create_job(job_id, {
            "type": "upload",
            "filename": file.filename,
            "file_path": file_path,
            "enhancement_preset": enhancement_preset
        })
        
        # Start processing pipeline
        pipeline = get_pipeline(job_manager)
        asyncio.create_task(pipeline.process_job(job_id))
        
        return JSONResponse({
            "ok": True,
            "data": {
                "job_id": job_id,
                "status": "processing",
                "message": "File uploaded and processing started"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "UPLOAD_FAILED", "message": str(e)}
            }
        )


@router.post("/extract")
async def extract_audio(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """Extract audio from video file."""
    job_id = str(uuid.uuid4())
    
    try:
        job_dir = os.path.join(JOBS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        # Save video file
        video_path = os.path.join(job_dir, f"original.{file.filename.split('.')[-1]}")
        with open(video_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Extract audio in background
        audio_path = os.path.join(job_dir, "extracted.wav")
        
        # Extract audio first
        extract_success = extract_audio_from_video(video_path, audio_path)
        if not extract_success:
            return JSONResponse(
                status_code=500,
                content={
                    "ok": False,
                    "error": {"code": "EXTRACTION_FAILED", "message": "Failed to extract audio"}
                }
            )
        
        job = job_manager.create_job(job_id, {
            "type": "extract",
            "video_path": video_path,
            "audio_path": audio_path,
            "enhancement_preset": "forensic"
        })
        
        # Start processing pipeline
        pipeline = get_pipeline(job_manager)
        asyncio.create_task(pipeline.process_job(job_id))
        
        return JSONResponse({
            "ok": True,
            "data": {
                "job_id": job_id,
                "status": "processing",
                "message": "Audio extracted and processing started"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "EXTRACTION_FAILED", "message": str(e)}
            }
        )


@router.post("/extract-url")
async def extract_audio_from_url_endpoint(
    url: str,
    background_tasks: BackgroundTasks = None
):
    """Extract audio from URL (YouTube, TikTok, etc.)."""
    job_id = str(uuid.uuid4())
    
    try:
        job_dir = os.path.join(JOBS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        audio_path = os.path.join(job_dir, "extracted.wav")
        
        # Extract audio (synchronous for now, can be made async later)
        extract_success = extract_audio_from_url(url, audio_path)
        if not extract_success:
            return JSONResponse(
                status_code=500,
                content={
                    "ok": False,
                    "error": {"code": "URL_EXTRACTION_FAILED", "message": "Failed to extract audio from URL"}
                }
            )
        
        job = job_manager.create_job(job_id, {
            "type": "extract_url",
            "url": url,
            "audio_path": audio_path,
            "enhancement_preset": "forensic"
        })
        
        # Start processing pipeline
        pipeline = get_pipeline(job_manager)
        asyncio.create_task(pipeline.process_job(job_id))
        
        return JSONResponse({
            "ok": True,
            "data": {
                "job_id": job_id,
                "status": "processing",
                "message": "URL extracted and processing started"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "URL_EXTRACTION_FAILED", "message": str(e)}
            }
        )


@router.post("/capture/start")
async def start_live_capture(
    duration: Optional[int] = 10,
    sample_rate: Optional[int] = 44100
):
    """Start live audio capture."""
    job_id = str(uuid.uuid4())
    
    try:
        job_dir = os.path.join(JOBS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        capture = AudioCapture()
        audio_path = os.path.join(job_dir, "captured.wav")
        
        # Start capture in background
        # Note: This would need proper async implementation
        job = job_manager.create_job(job_id, {
            "type": "capture",
            "duration": duration,
            "sample_rate": sample_rate,
            "audio_path": audio_path
        })
        
        return JSONResponse({
            "ok": True,
            "data": {
                "job_id": job_id,
                "status": "capturing",
                "message": "Live capture started"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "CAPTURE_FAILED", "message": str(e)}
            }
        )


@router.get("/jobs")
async def list_jobs():
    """List all jobs."""
    jobs = job_manager.list_jobs()
    return JSONResponse({
        "ok": True,
        "data": {"jobs": jobs}
    })


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Get job details."""
    job = job_manager.get_job(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": {"code": "JOB_NOT_FOUND", "message": "Job not found"}
            }
        )
    
    return JSONResponse({
        "ok": True,
        "data": job
    })


@router.get("/jobs/{job_id}/download")
async def download_job(job_id: str):
    """Download job package."""
    job = job_manager.get_job(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": {"code": "JOB_NOT_FOUND", "message": "Job not found"}
            }
        )
    
    # Check if package exists
    job_dir = os.path.join(JOBS_DIR, job_id)
    package_path = os.path.join(job_dir, f"{job_id}_FORENSIC_PACKAGE.zip")
    
    if not os.path.exists(package_path):
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": {"code": "PACKAGE_NOT_FOUND", "message": "Package not found"}
            }
        )
    
    return FileResponse(
        package_path,
        media_type="application/zip",
        filename=f"{job_id}_FORENSIC_PACKAGE.zip"
    )


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its files."""
    job = job_manager.get_job(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": {"code": "JOB_NOT_FOUND", "message": "Job not found"}
            }
        )
    
    try:
        # Delete job directory
        job_dir = os.path.join(JOBS_DIR, job_id)
        if os.path.exists(job_dir):
            import shutil
            shutil.rmtree(job_dir)
        
        # Remove from job manager (if it has a delete method)
        # For now, just return success
        
        return JSONResponse({
            "ok": True,
            "data": {
                "job_id": job_id,
                "message": "Job deleted successfully"
            }
        })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {"code": "DELETE_FAILED", "message": str(e)}
            }
        )


@router.get("/jobs/{job_id}/audio")
async def get_audio_file(job_id: str, path: Optional[str] = None):
    """Get audio file for playback."""
    job = job_manager.get_job(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": {"code": "JOB_NOT_FOUND", "message": "Job not found"}
            }
        )
    
    job_dir = os.path.join(JOBS_DIR, job_id)
    
    # Determine which audio file to serve
    if path:
        audio_path = os.path.join(job_dir, os.path.basename(path))
    elif job.get("enhanced_path"):
        audio_path = os.path.join(job_dir, os.path.basename(job["enhanced_path"]))
    else:
        # Find any audio file
        for file in os.listdir(job_dir):
            if file.endswith(('.wav', '.mp3', '.m4a', '.flac')):
                audio_path = os.path.join(job_dir, file)
                break
        else:
            return JSONResponse(
                status_code=404,
                content={
                    "ok": False,
                    "error": {"code": "AUDIO_NOT_FOUND", "message": "Audio file not found"}
                }
            )
    
    if not os.path.exists(audio_path):
        return JSONResponse(
            status_code=404,
            content={
                "ok": False,
                "error": {"code": "AUDIO_NOT_FOUND", "message": "Audio file not found"}
            }
        )
    
    # Determine media type
    ext = audio_path.split('.')[-1].lower()
    media_types = {
        'wav': 'audio/wav',
        'mp3': 'audio/mpeg',
        'm4a': 'audio/mp4',
        'flac': 'audio/flac'
    }
    
    return FileResponse(
        audio_path,
        media_type=media_types.get(ext, 'audio/wav'),
        filename=os.path.basename(audio_path)
    )


@router.websocket("/ws/{job_id}")
async def job_websocket(websocket: WebSocket, job_id: str):
    """WebSocket for job progress updates."""
    await websocket.accept()
    
    try:
        while True:
            # Send job status updates
            job = job_manager.get_job(job_id)
            if job:
                await websocket.send_json({
                    "job_id": job_id,
                    "status": job.get("status", "unknown"),
                    "progress": job.get("progress", 0)
                })
            
            # Wait for client message or timeout
            try:
                await websocket.receive_text()
            except:
                pass
            
            import asyncio
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
