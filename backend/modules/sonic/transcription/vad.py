"""
Voice Activity Detection
Detects speech segments in audio.
"""

from typing import List, Tuple
import re
import shutil
import subprocess


def detect_voice_activity(audio_path: str) -> List[Tuple[float, float]]:
    """Detect voice activity segments."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is required for VAD (silencedetect).")

    duration = None
    if shutil.which("ffprobe"):
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
            capture_output=True,
            text=True
        )
        if probe.returncode == 0 and probe.stdout.strip():
            try:
                duration = float(probe.stdout.strip())
            except ValueError:
                duration = None

    cmd = [
        "ffmpeg",
        "-i", audio_path,
        "-af", "silencedetect=noise=-30dB:d=0.3",
        "-f", "null",
        "-"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    output = result.stderr or ""

    silence_intervals: List[Tuple[float, float]] = []
    silence_start = None
    start_re = re.compile(r"silence_start:\s*([0-9.]+)")
    end_re = re.compile(r"silence_end:\s*([0-9.]+)")

    for line in output.splitlines():
        start_match = start_re.search(line)
        if start_match:
            silence_start = float(start_match.group(1))
            continue
        end_match = end_re.search(line)
        if end_match and silence_start is not None:
            silence_end = float(end_match.group(1))
            silence_intervals.append((silence_start, silence_end))
            silence_start = None

    if duration is None:
        if silence_intervals:
            duration = silence_intervals[-1][1]
        else:
            raise RuntimeError("Unable to determine audio duration for VAD.")

    segments: List[Tuple[float, float]] = []
    cursor = 0.0
    for start, end in silence_intervals:
        if start > cursor:
            segments.append((round(cursor, 3), round(start, 3)))
        cursor = max(cursor, end)

    if duration > cursor:
        segments.append((round(cursor, 3), round(duration, 3)))

    return segments
