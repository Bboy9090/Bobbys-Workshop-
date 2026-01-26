"""
WebSocket Manager for Pandora Codex
Manages real-time device streaming.
"""

from fastapi import WebSocket
from typing import Dict, List
import uuid


class DeviceStreamManager:
    """Manages WebSocket connections for device streaming."""
    
    def __init__(self):
        self.clients: Dict[str, WebSocket] = {}
    
    async def add_client(self, websocket: WebSocket) -> str:
        """Add a new WebSocket client."""
        client_id = str(uuid.uuid4())
        self.clients[client_id] = websocket
        return client_id
    
    def remove_client(self, client_id: str):
        """Remove a WebSocket client."""
        if client_id in self.clients:
            del self.clients[client_id]
    
    async def broadcast(self, message: dict):
        """Broadcast message to all clients."""
        disconnected = []
        
        for client_id, websocket in self.clients.items():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(client_id)
        
        # Remove disconnected clients
        for client_id in disconnected:
            self.remove_client(client_id)
    
    def get_client_count(self) -> int:
        """Get number of connected clients."""
        return len(self.clients)
