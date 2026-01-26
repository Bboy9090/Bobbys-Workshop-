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
        
        # Basic inspection (read-only, no mutation)
        # This is a placeholder - implement actual device inspection logic
        response_data = {
            "activation_locked": None,
            "mdm_enrolled": None,
            "frp_locked": None,
            "efi_locked": None
        }
        
        # TODO: Implement actual device inspection
        # - Use libimobiledevice for iOS
        # - Use ADB for Android
        # - Parse device state
        # - Return observations only
        
        response = {
            "ok": True,
            "data": response_data,
            "warnings": []
        }
        
        request_handler.send_response(200)
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
        
        # Deep inspection (more detailed, still read-only)
        response_data = {
            "signals": [],
            "notes": "deep probe completed"
        }
        
        # TODO: Implement deep inspection
        # - Battery state
        # - Storage health
        # - Thermal state
        # - System logs
        
        response = {
            "ok": True,
            "data": response_data,
            "warnings": ["partial_data"]
        }
        
        request_handler.send_response(200)
        request_handler.send_header('Content-Type', 'application/json')
        request_handler.end_headers()
        request_handler.wfile.write(json.dumps(response).encode('utf-8'))
