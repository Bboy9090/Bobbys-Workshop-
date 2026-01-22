"""
Log collection handler.
"""

import json
from app.policy import PolicyMode


class LogsHandler:
    """Log collection handler."""
    
    def __init__(self, policy_mode: PolicyMode):
        self.policy_mode = policy_mode
    
    def handle(self, request_handler, data: dict):
        """Handle log collection request."""
        device_id = data.get('device_id', '')
        scope = data.get('scope', 'default')
        
        response = {
            "ok": False,
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Log collection is not implemented in this service."
            }
        }
        
        request_handler.send_response(501)
        request_handler.send_header('Content-Type', 'application/json')
        request_handler.end_headers()
        request_handler.wfile.write(json.dumps(response).encode('utf-8'))
