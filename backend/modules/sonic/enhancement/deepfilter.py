"""
DeepFilter Enhancement
Advanced noise reduction using ffmpeg as a baseline.
"""

import os
import shutil
import subprocess


def apply_deepfilter(input_path: str, output_path: str) -> bool:
    """
    Apply DeepFilter-style noise reduction to a media file using ffmpeg's afftdn filter.
    
    Parameters:
        input_path (str): Path to the input media file to be processed.
        output_path (str): Path where the processed output file will be written; existing files will be overwritten.
    
    Returns:
        bool: `true` if ffmpeg ran successfully and the output file exists at `output_path`, `false` otherwise (including when ffmpeg is unavailable, the ffmpeg command fails, or an error occurs).
    """
    if not shutil.which("ffmpeg"):
        return False

    try:
        cmd = [
            "ffmpeg",
            "-y",
            "-i", input_path,
            "-af", "afftdn",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            return False
        return os.path.exists(output_path)
    except Exception:
        return False