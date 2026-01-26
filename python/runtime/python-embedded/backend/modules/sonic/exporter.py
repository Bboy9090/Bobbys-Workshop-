"""
Forensic Package Exporter
Creates export packages with all job artifacts.
"""

import os
import zipfile
import json
from typing import Dict


def create_forensic_package(job_id: str, job_dir: str, job_data: Dict) -> str:
    """Create forensic package ZIP file."""
    package_path = os.path.join(job_dir, f"{job_id}_FORENSIC_PACKAGE.zip")
    
    with zipfile.ZipFile(package_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add manifest
        manifest_path = os.path.join(job_dir, "manifest.json")
        if os.path.exists(manifest_path):
            zipf.write(manifest_path, "manifest.json")
        
        # Add original file
        for file in os.listdir(job_dir):
            if file.startswith("original."):
                zipf.write(
                    os.path.join(job_dir, file),
                    f"original/{file}"
                )
        
        # Add enhanced audio
        enhanced_path = os.path.join(job_dir, "enhanced.wav")
        if os.path.exists(enhanced_path):
            zipf.write(enhanced_path, "enhanced.wav")
        
        # Add transcript
        transcript_path = os.path.join(job_dir, "transcript.json")
        if os.path.exists(transcript_path):
            zipf.write(transcript_path, "transcript.json")
        
        # Add diarization
        diarization_path = os.path.join(job_dir, "diarization.json")
        if os.path.exists(diarization_path):
            zipf.write(diarization_path, "diarization.json")
    
    return package_path
