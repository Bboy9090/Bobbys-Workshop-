"""
Whisper Transcription Engine
Uses faster-whisper (local) for speech-to-text with translation support.
"""

import json
from typing import Dict, Optional
import os

# Try faster-whisper first, fallback to openai-whisper
try:
    from faster_whisper import WhisperModel
    HAS_FASTER_WHISPER = True
except ImportError:
    try:
        import whisper
        HAS_FASTER_WHISPER = False
    except ImportError:
        HAS_FASTER_WHISPER = None
        whisper = None


def transcribe_audio(
    audio_path: str,
    language: Optional[str] = None,
    model_size: str = "large-v3",
    translate: bool = True,
    beam_size: int = 10
) -> Dict:
    """Transcribe audio using Whisper with optional translation."""
    if not os.path.exists(audio_path):
        return {
            "text": "",
            "language": "unknown",
            "segments": [],
            "success": False,
            "error": "Audio file not found"
        }
    
    try:
        if HAS_FASTER_WHISPER:
            # Use faster-whisper (faster, local)
            model = WhisperModel(model_size, device="cpu", compute_type="int8")
            
            # Transcribe
            segments, info = model.transcribe(
                audio_path,
                language=language,
                task="translate" if translate else "transcribe",
                beam_size=beam_size,
                patience=2.0
            )
            
            # Collect segments
            segment_list = []
            full_text = ""
            
            for segment in segments:
                segment_data = {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text,
                    "confidence": getattr(segment, 'avg_logprob', 0.0)
                }
                segment_list.append(segment_data)
                full_text += segment.text + " "
            
            return {
                "text": full_text.strip(),
                "language": info.language,
                "language_probability": info.language_probability,
                "segments": segment_list,
                "success": True,
                "model": "faster-whisper",
                "model_size": model_size
            }
        
        elif whisper:
            # Fallback to openai-whisper
            model = whisper.load_model(model_size)
            
            result = model.transcribe(
                audio_path,
                language=language,
                task="translate" if translate else "transcribe",
                beam_size=beam_size,
                patience=2.0
            )
            
            return {
                "text": result["text"],
                "language": result.get("language", "unknown"),
                "language_probability": result.get("language_probability", 0.0),
                "segments": result.get("segments", []),
                "success": True,
                "model": "openai-whisper",
                "model_size": model_size
            }
        else:
            return {
                "text": "",
                "language": "unknown",
                "segments": [],
                "success": False,
                "error": "Whisper not installed. Install faster-whisper or openai-whisper"
            }
            
    except Exception as e:
        return {
            "text": "",
            "language": "unknown",
            "segments": [],
            "success": False,
            "error": str(e)
        }
