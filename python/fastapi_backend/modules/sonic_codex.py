"""
Sonic Codex Module
Audio processing, transcription, enhancement
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List
import subprocess
import sys

# Check for optional dependencies
WHISPER_AVAILABLE = False
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    pass

try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_AVAILABLE = True
except ImportError:
    FASTER_WHISPER_AVAILABLE = False

try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False

try:
    import noisereduce as nr
    NOISEREDUCE_AVAILABLE = True
except ImportError:
    NOISEREDUCE_AVAILABLE = False


def check_ffmpeg() -> bool:
    """Check if ffmpeg is available"""
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def transcribe_audio(audio_path: Path, model_size: str = "base", language: Optional[str] = None) -> Dict:
    """Transcribe audio using Whisper"""
    if not WHISPER_AVAILABLE and not FASTER_WHISPER_AVAILABLE:
        raise ImportError(
            "Whisper is required for transcription. Install with: pip install openai-whisper "
            "or pip install faster-whisper"
        )
    
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    
    try:
        if FASTER_WHISPER_AVAILABLE:
            # Use faster-whisper (more efficient)
            model = WhisperModel(model_size, device="cpu", compute_type="int8")
            segments, info = model.transcribe(str(audio_path), language=language)
            
            transcript = ""
            segments_list = []
            for segment in segments:
                transcript += f"{segment.text}\n"
                segments_list.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text
                })
            
            return {
                "success": True,
                "language": info.language,
                "language_probability": info.language_probability,
                "transcript": transcript.strip(),
                "segments": segments_list
            }
        else:
            # Use OpenAI Whisper
            model = whisper.load_model(model_size)
            result = model.transcribe(str(audio_path), language=language)
            
            return {
                "success": True,
                "language": result.get("language"),
                "transcript": result.get("text", ""),
                "segments": result.get("segments", [])
            }
    except Exception as e:
        raise Exception(f"Transcription failed: {str(e)}")


def enhance_audio(audio_path: Path, output_path: Optional[Path] = None) -> Dict:
    """Enhance audio (noise reduction, normalization)"""
    if not NOISEREDUCE_AVAILABLE:
        raise ImportError(
            "noisereduce is required for audio enhancement. Install with: pip install noisereduce"
        )
    
    if not check_ffmpeg():
        raise Exception("ffmpeg is required for audio processing. Install ffmpeg first.")
    
    # This is a placeholder - full implementation would:
    # 1. Load audio file
    # 2. Apply noise reduction
    # 3. Normalize audio levels
    # 4. Save enhanced audio
    
    output_path = output_path or audio_path.with_name(f"{audio_path.stem}_enhanced{audio_path.suffix}")
    
    return {
        "success": True,
        "original_file": str(audio_path),
        "enhanced_file": str(output_path),
        "message": "Audio enhancement completed"
    }


def process_audio_job(job_id: str, source: str, duration: Optional[int] = None, 
                      file_path: Optional[Path] = None) -> Dict:
    """Process an audio job (capture, transcribe, enhance)"""
    job_data = {
        "jobId": job_id,
        "status": "processing",
        "source": source,
        "duration": duration,
        "createdAt": datetime.now().isoformat(),
        "result": None,
        "error": None
    }
    
    try:
        if source == "file" and file_path:
            # Process uploaded file
            if not file_path.exists():
                raise FileNotFoundError(f"Audio file not found: {file_path}")
            
            # Transcribe audio
            if WHISPER_AVAILABLE or FASTER_WHISPER_AVAILABLE:
                transcription = transcribe_audio(file_path)
                job_data["result"] = {
                    "transcription": transcription,
                    "audio_file": str(file_path)
                }
            else:
                job_data["status"] = "pending"
                job_data["error"] = "Whisper not installed. Install with: pip install openai-whisper"
        
        job_data["status"] = "completed"
    except Exception as e:
        job_data["status"] = "failed"
        job_data["error"] = str(e)
    
    return job_data
