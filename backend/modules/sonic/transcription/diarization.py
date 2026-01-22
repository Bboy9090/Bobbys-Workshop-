"""
Speaker Diarization
Identifies who spoke when.
"""

from typing import Dict, List
import os


def diarize_speakers(audio_path: str) -> List[Dict]:
    """Perform speaker diarization."""
    token = os.getenv("HUGGINGFACE_TOKEN")
    if not token:
        raise RuntimeError("HUGGINGFACE_TOKEN is required for speaker diarization.")

    try:
        from pyannote.audio import Pipeline
    except ImportError as exc:
        raise RuntimeError("pyannote.audio is required for speaker diarization.") from exc

    pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization", use_auth_token=token)
    diarization = pipeline(audio_path)

    segments: List[Dict] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            "speaker": speaker,
            "start": float(turn.start),
            "end": float(turn.end)
        })

    return segments
