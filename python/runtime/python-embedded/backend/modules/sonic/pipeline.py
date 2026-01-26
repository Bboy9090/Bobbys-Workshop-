"""
Sonic Codex Processing Pipeline
Automatically processes jobs: Upload → Enhance → Transcribe → Package
"""

import os
import asyncio
from typing import Dict, Optional
from datetime import datetime
from .job_manager import JobManager
from .enhancement.preprocess import preprocess_audio
from .enhancement.consonant_boost import apply_consonant_boost
from .transcription.whisper_engine import transcribe_audio
from .exporter import create_forensic_package
from .naming import generate_job_filename, generate_enhanced_filename
import json

JOBS_DIR = os.path.join(os.path.dirname(__file__), "../../../jobs")


class ProcessingPipeline:
    """Processes audio jobs through the full pipeline."""
    
    def __init__(self, job_manager: JobManager):
        self.job_manager = job_manager
    
    async def process_job(self, job_id: str) -> Dict:
        """Process a job through the full pipeline."""
        job = self.job_manager.get_job(job_id)
        if not job:
            return {"success": False, "error": "Job not found"}
        
        job_dir = os.path.join(JOBS_DIR, job_id)
        metadata = job.get("metadata", {})
        
        try:
            # Stage 1: Find input file
            self.job_manager.update_job(job_id, {
                "status": "preprocessing",
                "progress": 10
            })
            
            # Find original file
            original_file = None
            for file in os.listdir(job_dir):
                if file.startswith("original."):
                    original_file = os.path.join(job_dir, file)
                    break
            
            if not original_file:
                # Check for extracted audio
                extracted_file = os.path.join(job_dir, "extracted.wav")
                if os.path.exists(extracted_file):
                    original_file = extracted_file
                else:
                    return {"success": False, "error": "No input file found"}
            
            # Stage 2: Preprocessing
            self.job_manager.update_job(job_id, {
                "status": "preprocessing",
                "progress": 20
            })
            
            preprocessed_path = os.path.join(job_dir, "preprocessed.wav")
            preset = metadata.get("enhancement_preset", "forensic")
            
            # Apply preprocessing
            preprocess_success = preprocess_audio(original_file, preprocessed_path, preset)
            if not preprocess_success:
                # If preprocessing fails, use original
                preprocessed_path = original_file
            
            # Stage 3: Enhancement
            self.job_manager.update_job(job_id, {
                "status": "enhancing",
                "progress": 40
            })
            
            # Generate human-readable filename
            try:
                created_at = datetime.fromisoformat(job.get("created_at", datetime.now().isoformat()))
            except:
                created_at = datetime.now()
            
            base_name = generate_job_filename(
                device=metadata.get("device"),
                title=metadata.get("title"),
                timestamp=created_at
            )
            
            enhanced_filename = generate_enhanced_filename(base_name)
            enhanced_path = os.path.join(job_dir, enhanced_filename)
            enhance_success = apply_consonant_boost(preprocessed_path, enhanced_path, boost_db=6.0)
            if not enhance_success:
                # If enhancement fails, use preprocessed
                enhanced_path = preprocessed_path
                enhanced_filename = "preprocessed.wav"
            
            # Stage 4: Transcription
            self.job_manager.update_job(job_id, {
                "status": "transcribing",
                "progress": 60
            })
            
            # Transcribe with translation
            transcript_result = transcribe_audio(
                enhanced_path,
                language=None,  # Auto-detect
                model_size="large-v3",
                translate=True,
                beam_size=10
            )
            
            if not transcript_result.get("success"):
                return {
                    "success": False,
                    "error": transcript_result.get("error", "Transcription failed")
                }
            
            # Save transcripts
            transcript_original_path = os.path.join(job_dir, "transcript_original.json")
            transcript_english_path = os.path.join(job_dir, "transcript_english.json")
            
            # Save English transcript (translated)
            transcript_data = {
                "text": transcript_result.get("text", ""),
                "language": transcript_result.get("language", "unknown"),
                "language_probability": transcript_result.get("language_probability", 0.0),
                "segments": transcript_result.get("segments", []),
                "translated": True,
                "model": transcript_result.get("model", "unknown"),
                "model_size": transcript_result.get("model_size", "unknown")
            }
            
            with open(transcript_english_path, "w") as f:
                json.dump(transcript_data, f, indent=2)
            
            # Also save as original if language is not English
            if transcript_result.get("language") != "en":
                with open(transcript_original_path, "w") as f:
                    json.dump(transcript_data, f, indent=2)
            
            # Stage 5: Package Generation
            self.job_manager.update_job(job_id, {
                "status": "packaging",
                "progress": 80
            })
            
            # Update job with transcript data
            job_data = {
                "transcript": transcript_result.get("text", ""),
                "language": transcript_result.get("language", "unknown"),
                "segments": transcript_result.get("segments", []),
                "enhanced_path": enhanced_filename if enhance_success else None,
                "enhanced_full_path": enhanced_path,
                "transcript_path": transcript_english_path,
                "base_name": base_name
            }
            
            # Generate package
            package_path = create_forensic_package(job_id, job_dir, {
                **job,
                **job_data
            })
            
            # Stage 6: Complete
            self.job_manager.update_job(job_id, {
                "status": "complete",
                "progress": 100,
                **job_data,
                "package_path": package_path
            })
            
            return {
                "success": True,
                "job_id": job_id,
                "transcript": transcript_result.get("text", ""),
                "language": transcript_result.get("language", "unknown")
            }
            
        except Exception as e:
            self.job_manager.update_job(job_id, {
                "status": "failed",
                "error": str(e)
            })
            return {
                "success": False,
                "error": str(e)
            }
    
    async def process_job_async(self, job_id: str):
        """Process job in background."""
        # Run in background task
        asyncio.create_task(self.process_job(job_id))


# Global pipeline instance
_pipeline_instance: Optional[ProcessingPipeline] = None


def get_pipeline(job_manager: JobManager) -> ProcessingPipeline:
    """Get or create pipeline instance."""
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = ProcessingPipeline(job_manager)
    return _pipeline_instance
