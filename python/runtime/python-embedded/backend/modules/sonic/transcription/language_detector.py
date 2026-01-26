"""
Language Detection
Detects language from audio.
"""

import whisper


def detect_language(audio_path: str) -> str:
    """Detect language from audio."""
    try:
        model = whisper.load_model("base")
        result = model.transcribe(audio_path, task="language_detection")
        return result.get("language", "unknown")
    except Exception:
        return "unknown"
