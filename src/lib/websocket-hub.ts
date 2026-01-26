/**
 * WebSocket Hub
 * 
 * GOD MODE: Centralized WebSocket connection management.
 * Single connection, multiple event streams, automatic reconnection.
 */

import { createLogger } from '@/lib/debug-logger';

const logger = createLogger('WebSocketHub');

type EventCallback = (data: unknown) => void;
type ConnectionCallback = () => void;

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

class WebSocketHub {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private connectionListeners: Set<ConnectionCallback> = new Set();
  private disconnectionListeners: Set<ConnectionCallback> = new Set();
  private messageQueue: WebSocketMessage[] = [];
  private isConnecting = false;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        logger.info('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Notify connection listeners
        this.connectionListeners.forEach(cb => cb());
        
        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          if (msg) this.send(msg);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          const type = data.type;
          
          // Notify type-specific listeners
          const listeners = this.eventListeners.get(type);
          if (listeners) {
            listeners.forEach(cb => cb(data));
          }
          
          // Notify wildcard listeners
          const wildcardListeners = this.eventListeners.get('*');
          if (wildcardListeners) {
            wildcardListeners.forEach(cb => cb(data));
          }
        } catch (e) {
          logger.warn('Failed to parse WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        logger.info('WebSocket disconnected');
        this.isConnecting = false;
        this.ws = null;
        
        // Notify disconnection listeners
        this.disconnectionListeners.forEach(cb => cb());
        
        // Attempt reconnect
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        logger.error('WebSocket error', error);
        this.isConnecting = false;
      };

    } catch (e) {
      logger.error('Failed to create WebSocket', e);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  /**
   * Send a message
   */
  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue for later
      this.messageQueue.push(message);
    }
  }

  /**
   * Subscribe to an event type
   */
  on(eventType: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Subscribe to all events
   */
  onAny(callback: EventCallback): () => void {
    return this.on('*', callback);
  }

  /**
   * Subscribe to connection event
   */
  onConnect(callback: ConnectionCallback): () => void {
    this.connectionListeners.add(callback);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  /**
   * Subscribe to disconnection event
   */
  onDisconnect(callback: ConnectionCallback): () => void {
    this.disconnectionListeners.add(callback);
    return () => {
      this.disconnectionListeners.delete(callback);
    };
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  get state(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'closed';
    }
  }
}

// Singleton instances for different WebSocket endpoints
export const deviceEventsHub = new WebSocketHub('ws://localhost:3001/ws/device-events');
export const correlationHub = new WebSocketHub('ws://localhost:3001/ws/correlation');
export const analyticsHub = new WebSocketHub('ws://localhost:3001/ws/analytics');

// Initialize connections
export function initializeWebSockets(): void {
  deviceEventsHub.connect();
  correlationHub.connect();
}

// Cleanup connections
export function cleanupWebSockets(): void {
  deviceEventsHub.disconnect();
  correlationHub.disconnect();
  analyticsHub.disconnect();
}

export default WebSocketHub;
