"""
Health check endpoint handler.
"""

import json
import time


class HealthHandler:
    """Health check handler."""
    
    def __init__(self):
        self.start_time = time.time()
    
    def handle(self, request_handler):
        """Handle health check request."""
        uptime_ms = int((time.time() - self.start_time) * 1000)
        
        response = {
            "status": "ok",
            "version": "py-worker-1.0.0",
            "uptime_ms": uptime_ms
        }
        
        request_handler.send_response(200)
        request_handler.send_header('Content-Type', 'application/json')
        request_handler.end_headers()
        request_handler.wfile.write(json.dumps(response).encode('utf-8'))
