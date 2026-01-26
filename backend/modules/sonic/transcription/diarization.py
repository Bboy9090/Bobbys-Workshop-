"""
Speaker Diarization
Identifies who spoke when.
"""

from typing import Dict, List
import os


def diarize_speakers(audio_path: str) -> List[Dict]:
    """
    Extract speaker-labelled time segments from the given audio file.
    
    Parameters:
        audio_path (str): Filesystem path or URL of the audio file to analyze.
    
    Returns:
        List[Dict]: A list of segment dictionaries, each containing:
            - "speaker": speaker label (str)
            - "start": segment start time in seconds (float)
            - "end": segment end time in seconds (float)
    
    Raises:
        RuntimeError: If the HUGGINGFACE_TOKEN environment variable is not set.
        RuntimeError: If the required dependency `pyannote.audio` cannot be imported.
    """
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