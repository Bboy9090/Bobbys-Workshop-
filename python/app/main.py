"""
Bobby's Workshop - Python Backend Service
Stateless worker for device inspection, log collection, and report formatting.
"""

import argparse
import signal
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import threading
from typing import Optional

from app.health import HealthHandler
from app.inspect import InspectHandler
from app.logs import LogsHandler
from app.report import ReportHandler
from app.policy import PolicyMode


class BackendHandler(BaseHTTPRequestHandler):
    """Main request handler for Python backend service."""
    
    def __init__(self, *args, policy_mode: str = "public", **kwargs):
        self.policy_mode = PolicyMode(policy_mode)
        super().__init__(*args, **kwargs)
    
    def log_message(self, format, *args):
        """Suppress default logging."""
        pass
    
    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == "/health":
            handler = HealthHandler()
            handler.handle(self)
        else:
            self.send_error(404, "Not Found")
    
    def do_POST(self):
        """Handle POST requests."""
        parsed = urlparse(self.path)
        path = parsed.path
        
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b'{}'
        
        try:
            data = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        
        # Route to appropriate handler
        if path == "/inspect/basic":
            handler = InspectHandler(self.policy_mode)
            handler.handle(self, data)
        elif path == "/inspect/deep":
            handler = InspectHandler(self.policy_mode)
            handler.handle_deep(self, data)
        elif path == "/logs/collect":
            handler = LogsHandler(self.policy_mode)
            handler.handle(self, data)
        elif path == "/report/format":
            handler = ReportHandler(self.policy_mode)
            handler.handle(self, data)
        else:
            self.send_error(404, "Not Found")


class BackendServer:
    """Python backend server."""
    
    def __init__(self, port: int, policy_mode: str = "public"):
        self.port = port
        self.policy_mode = policy_mode
        self.server: Optional[HTTPServer] = None
        self.start_time = time.time()
    
    def start(self):
        """Start the backend server."""
        def handler_factory(*args, **kwargs):
            return BackendHandler(*args, policy_mode=self.policy_mode, **kwargs)
        
        self.server = HTTPServer(('127.0.0.1', self.port), handler_factory)
        
        print(f"Python backend starting on 127.0.0.1:{self.port}", file=sys.stderr)
        print(f"Policy mode: {self.policy_mode}", file=sys.stderr)
        
        # Run server in background thread
        server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        server_thread.start()
    
    def stop(self):
        """Stop the backend server."""
        if self.server:
            self.server.shutdown()
            self.server.server_close()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Bobby's Workshop Python Backend")
    parser.add_argument('--port', type=int, default=0, help='Port to bind (0 = auto)')
    parser.add_argument('--policy-mode', type=str, default='public', help='Policy mode')
    parser.add_argument('--data-dir', type=str, help='Data directory path')
    
    args = parser.parse_args()
    
    # Pick port if not specified
    port = args.port
    if port == 0:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
    
    # Create and start server
    server = BackendServer(port, args.policy_mode)
    
    # Handle shutdown signals
    def signal_handler(sig, frame):
        print("Shutting down Python backend...", file=sys.stderr)
        server.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Start server
    server.start()
    
    # Print port to stdout (Tauri reads this)
    print(port, flush=True)
    
    # Keep process alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        signal_handler(None, None)


if __name__ == "__main__":
    main()
