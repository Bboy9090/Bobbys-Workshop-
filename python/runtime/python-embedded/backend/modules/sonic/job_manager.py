"""
Job Manager for Sonic Codex
Manages job lifecycle and status tracking.
"""

import os
import json
from typing import Dict, Optional, List
from datetime import datetime

JOBS_DIR = os.path.join(os.path.dirname(__file__), "../../../jobs")


class JobManager:
    """Manages audio processing jobs."""
    
    def __init__(self):
        self.jobs: Dict[str, Dict] = {}
        os.makedirs(JOBS_DIR, exist_ok=True)
    
    def create_job(self, job_id: str, metadata: Dict) -> Dict:
        """Create a new job."""
        job = {
            "job_id": job_id,
            "status": "created",
            "progress": 0,
            "created_at": datetime.now().isoformat(),
            "metadata": metadata
        }
        
        self.jobs[job_id] = job
        self._save_job(job_id, job)
        return job
    
    def update_job(self, job_id: str, updates: Dict) -> Optional[Dict]:
        """Update job status."""
        if job_id not in self.jobs:
            return None
        
        self.jobs[job_id].update(updates)
        self._save_job(job_id, self.jobs[job_id])
        return self.jobs[job_id]
    
    def get_job(self, job_id: str) -> Optional[Dict]:
        """Get job by ID."""
        if job_id in self.jobs:
            return self.jobs[job_id]
        
        # Try to load from disk
        return self._load_job(job_id)
    
    def list_jobs(self) -> List[Dict]:
        """List all jobs."""
        # Load all jobs from disk
        jobs = []
        if os.path.exists(JOBS_DIR):
            for job_id in os.listdir(JOBS_DIR):
                job_path = os.path.join(JOBS_DIR, job_id, "manifest.json")
                if os.path.exists(job_path):
                    job = self._load_job(job_id)
                    if job:
                        jobs.append(job)
        
        return sorted(jobs, key=lambda x: x.get("created_at", ""), reverse=True)
    
    def _save_job(self, job_id: str, job: Dict):
        """Save job to disk."""
        job_dir = os.path.join(JOBS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        manifest_path = os.path.join(job_dir, "manifest.json")
        with open(manifest_path, "w") as f:
            json.dump(job, f, indent=2)
    
    def _load_job(self, job_id: str) -> Optional[Dict]:
        """Load job from disk."""
        manifest_path = os.path.join(JOBS_DIR, job_id, "manifest.json")
        if not os.path.exists(manifest_path):
            return None
        
        try:
            with open(manifest_path, "r") as f:
                job = json.load(f)
                self.jobs[job_id] = job
                return job
        except Exception:
            return None
