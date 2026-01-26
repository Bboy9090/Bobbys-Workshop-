"""
File Upload Handler
Handles audio/video file uploads.
"""

import os
from typing import Optional


async def handle_file_upload(file, job_dir: str) -> str:
    """Handle uploaded file and return path."""
    os.makedirs(job_dir, exist_ok=True)
    
    # Get file extension
    filename = file.filename or "upload"
    ext = filename.split('.')[-1] if '.' in filename else "bin"
    
    file_path = os.path.join(job_dir, f"original.{ext}")
    
    # Save file
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return file_path
