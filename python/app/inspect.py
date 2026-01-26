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
        """
        Handle a device inspection request, enforcing policy and returning a standardized error.
        
        If inspection is disallowed by the configured policy, sends an HTTP 403 error and returns.
        If inspection is allowed, sends an HTTP 501 response with a JSON body containing an error
        object (code "NOT_IMPLEMENTED" and a descriptive message).
        
        Parameters:
            request_handler: HTTP request handler used to send responses (must support send_error, send_response,
                send_header, end_headers, and a writable `wfile`).
            data (dict): Request payload; may include `device_id` (str) and `platform` (str) keys which
                are used only for context in the request.
        """
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
        """
        Handle a deep device inspection request and respond according to policy.
        
        Checks whether deep probing is allowed via the handler's policy_mode. If not allowed, sends an HTTP 403 error. If allowed, sends an HTTP 501 response with a JSON payload containing an error code `"NOT_IMPLEMENTED"` and a message indicating deep inspection is not implemented.
        
        Parameters:
            request_handler: The HTTP request handler used to send responses (must implement send_error, send_response, send_header, end_headers and have a writable `wfile`).
            data (dict): Request payload; may include the keys:
                - device_id (str): Identifier of the target device (default '').
                - platform (str): Device platform identifier (default 'unknown').
        """
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