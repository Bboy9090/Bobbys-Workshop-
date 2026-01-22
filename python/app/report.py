"""
Report formatting handler.
"""

import json
from app.policy import PolicyMode


class ReportHandler:
    """Report formatting handler."""
    
    def __init__(self, policy_mode: PolicyMode):
        self.policy_mode = policy_mode
    
    def handle(self, request_handler, data: dict):
        """Handle report formatting request."""
        report_id = data.get('report_id', '')
        format_type = data.get('format', 'json')
        
        response = {
            "ok": False,
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Report formatting is not implemented in this service."
            }
        }
        
        request_handler.send_response(501)
        request_handler.send_header('Content-Type', 'application/json')
        request_handler.end_headers()
        request_handler.wfile.write(json.dumps(response).encode('utf-8'))
