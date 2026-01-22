"""
Device inspection handlers.
"""

import json
from app.policy import PolicyMode


class InspectHandler:
    """Device inspection handler."""
    
    def __init__(self, policy_mode: PolicyMode):
        self.policy_mode = policy_mode
    
    def handle(self, request_handler, data: dict):
        """Handle basic inspection request."""
        if not self.policy_mode.allows_inspect():
            request_handler.send_error(403, "Inspect not allowed")
            return
        
        device_id = data.get('device_id', '')
        platform = data.get('platform', 'unknown')
        
        response = {
            "ok": False,
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Device inspection is not implemented in this service."
            }
        }
        
        request_handler.send_response(501)
        request_handler.send_header('Content-Type', 'application/json')
        request_handler.end_headers()
        request_handler.wfile.write(json.dumps(response).encode('utf-8'))
    
    def handle_deep(self, request_handler, data: dict):
        """Handle deep inspection request."""
        if not self.policy_mode.allows_deep_probe():
            request_handler.send_error(403, "Deep probe not allowed")
            return
        
        device_id = data.get('device_id', '')
        platform = data.get('platform', 'unknown')
        
        response = {
            "ok": False,
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Deep inspection is not implemented in this service."
            }
        }
        
        request_handler.send_response(501)
        request_handler.send_header('Content-Type', 'application/json')
        request_handler.end_headers()
        request_handler.wfile.write(json.dumps(response).encode('utf-8'))
