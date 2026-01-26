/**
 * LEGENDARY WebSocket Connection Manager
 * 
 * Features:
 * - Automatic heartbeat/ping-pong to prevent idle disconnections
 * - Connection health monitoring
 * - Graceful reconnection handling
 * - Connection pooling
 * - Keep-alive mechanism
 */

import { WebSocketServer } from 'ws';

export class LegendaryWebSocketManager {
  constructor(server, path, options = {}) {
    this.path = path;
    this.clients = new Map(); // Map<ws, ClientInfo>
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
    this.heartbeatTimeout = options.heartbeatTimeout || 10000; // 10 seconds
    this.maxMissedHeartbeats = options.maxMissedHeartbeats || 3;
    this.wss = new WebSocketServer({ server, path });
    this.heartbeatTimer = null;
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      reconnections: 0,
      disconnections: 0,
      errors: 0
    };

    this.setupServer();
    this.startHeartbeat();
  }

  setupServer() {
    // Store original connection handler
    this.originalConnectionHandler = null;
    
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const clientInfo = {
        id: clientId,
        connectedAt: Date.now(),
        lastPong: Date.now(),
        missedHeartbeats: 0,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] || 'unknown'
      };

      this.clients.set(ws, clientInfo);
      this.stats.totalConnections++;
      this.stats.activeConnections = this.clients.size;

      console.log(`[WS:${this.path}] Client connected: ${clientId} (${this.clients.size} active)`);

      // Send welcome message
      this.send(ws, {
        type: 'connected',
        clientId,
        serverTime: new Date().toISOString(),
        heartbeatInterval: this.heartbeatInterval
      });

      // Handle pong responses
      ws.on('pong', () => {
        const info = this.clients.get(ws);
        if (info) {
          info.lastPong = Date.now();
          info.missedHeartbeats = 0;
        }
      });

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error(`[WS:${this.path}] Failed to parse message:`, error);
        }
      });

      // Handle close
      ws.on('close', (code, reason) => {
        const info = this.clients.get(ws);
        if (info) {
          const duration = Date.now() - info.connectedAt;
          console.log(`[WS:${this.path}] Client disconnected: ${info.id} (code: ${code}, duration: ${Math.round(duration / 1000)}s)`);
        }
        this.clients.delete(ws);
        this.stats.activeConnections = this.clients.size;
        this.stats.disconnections++;
      });

      // Handle errors
      ws.on('error', (error) => {
        const info = this.clients.get(ws);
        console.error(`[WS:${this.path}] Error for client ${info?.id || 'unknown'}:`, error);
        this.stats.errors++;
        this.clients.delete(ws);
        this.stats.activeConnections = this.clients.size;
      });
    });

    this.wss.on('error', (error) => {
      console.error(`[WS:${this.path}] Server error:`, error);
      this.stats.errors++;
    });
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((info, ws) => {
        if (ws.readyState === ws.OPEN) {
          // Check if client is still responding
          const timeSinceLastPong = Date.now() - info.lastPong;
          
          if (timeSinceLastPong > this.heartbeatTimeout * this.maxMissedHeartbeats) {
            console.warn(`[WS:${this.path}] Client ${info.id} not responding, closing connection`);
            ws.terminate();
            this.clients.delete(ws);
            this.stats.activeConnections = this.clients.size;
            return;
          }

          // Send ping
          try {
            ws.ping();
            info.missedHeartbeats++;
          } catch (error) {
            console.error(`[WS:${this.path}] Failed to ping client ${info.id}:`, error);
            this.clients.delete(ws);
            this.stats.activeConnections = this.clients.size;
          }
        } else {
          // Remove dead connections
          this.clients.delete(ws);
          this.stats.activeConnections = this.clients.size;
        }
      });
    }, this.heartbeatInterval);
  }

  handleMessage(ws, message) {
    const info = this.clients.get(ws);
    if (!info) return;

    // Handle ping from client
    if (message.type === 'ping') {
      this.send(ws, { type: 'pong', timestamp: Date.now() });
      return;
    }

    // Handle custom message types
    if (message.type === 'reconnect') {
      info.missedHeartbeats = 0;
      info.lastPong = Date.now();
      this.stats.reconnections++;
      this.send(ws, { type: 'reconnected', clientId: info.id });
    }
  }

  send(ws, data) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error(`[WS:${this.path}] Failed to send message:`, error);
        return false;
      }
    }
    return false;
  }

  broadcast(data, excludeWs = null) {
    let sent = 0;
    this.clients.forEach((info, ws) => {
      if (ws !== excludeWs && this.send(ws, data)) {
        sent++;
      }
    });
    return sent;
  }

  getStats() {
    return {
      ...this.stats,
      activeConnections: this.clients.size,
      path: this.path
    };
  }

  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.clients.forEach((info, ws) => {
      ws.close();
    });
    this.clients.clear();
    this.wss.close();
  }
}
