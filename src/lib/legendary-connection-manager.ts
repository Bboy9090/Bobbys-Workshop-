/**
 * 🔱 LEGENDARY Connection Manager
 * 
 * GOD MODE: Bulletproof backend connection with:
 * - Exponential backoff with jitter
 * - Health-aware reconnection
 * - Connection state persistence
 * - Automatic recovery
 * - Smart retry logic
 */

import { createLogger } from './debug-logger';
import { checkBackendHealth } from './backend-health';

const logger = createLogger('LegendaryConnection');

interface ConnectionConfig {
  url: string;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  jitter?: boolean;
  healthCheckBeforeReconnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (data: unknown) => void;
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  reconnectAttempts: number;
  lastConnectTime: number | null;
  lastDisconnectTime: number | null;
  consecutiveFailures: number;
}

export class LegendaryConnectionManager {
  private ws: WebSocket | null = null;
  private config: Required<ConnectionConfig>;
  private state: ConnectionState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageQueue: unknown[] = [];
  private isDestroyed = false;

  constructor(config: ConnectionConfig) {
    this.config = {
      maxReconnectAttempts: config.maxReconnectAttempts ?? Infinity, // Never give up!
      initialReconnectDelay: config.initialReconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 60000, // Max 60 seconds
      jitter: config.jitter ?? true,
      healthCheckBeforeReconnect: config.healthCheckBeforeReconnect ?? true,
      onConnect: config.onConnect ?? (() => {}),
      onDisconnect: config.onDisconnect ?? (() => {}),
      onError: config.onError ?? (() => {}),
      onMessage: config.onMessage ?? (() => {}),
      url: config.url
    };

    this.state = {
      status: 'disconnected',
      reconnectAttempts: 0,
      lastConnectTime: null,
      lastDisconnectTime: null,
      consecutiveFailures: 0
    };

    // Restore connection state from localStorage if available
    this.restoreState();
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.debug('Already connected');
      return;
    }
    if (this.state.status === 'connecting' || this.state.status === 'reconnecting') {
      logger.debug('Connection already in progress');
      return;
    }

    // Check backend health before connecting
    if (this.config.healthCheckBeforeReconnect) {
      const health = await checkBackendHealth();
      if (!health.isHealthy) {
        logger.debug('Backend unhealthy, scheduling health check retry');
        this.scheduleHealthCheck();
        return;
      }
    }

    this.setState({ status: 'connecting' });

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupWebSocket();
    } catch (error) {
      logger.error('Failed to create WebSocket:', error);
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocket(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      logger.info('WebSocket connected');
      this.setState({
        status: 'connected',
        reconnectAttempts: 0,
        lastConnectTime: Date.now(),
        consecutiveFailures: 0
      });

      // Flush queued messages
      this.flushMessageQueue();

      // Start ping interval
      this.startPing();

      // Notify listeners
      this.config.onConnect();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle pong
        if (data.type === 'pong') {
          return;
        }

        // Handle reconnected message
        if (data.type === 'reconnected') {
          logger.info('Server confirmed reconnection');
          return;
        }

        this.config.onMessage(data);
      } catch (error) {
        logger.warn('Failed to parse message:', error);
      }
    };

    this.ws.onclose = (event) => {
      logger.info(`WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
      this.setState({
        status: 'disconnected',
        lastDisconnectTime: Date.now()
      });

      this.cleanup();
      this.config.onDisconnect();

      // Only reconnect if not a normal closure
      if (event.code !== 1000 && !this.isDestroyed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
      this.handleConnectionError(new Error('WebSocket error'));
    };
  }

  /**
   * Schedule reconnection with exponential backoff and jitter
   */
  private scheduleReconnect(): void {
    if (this.isDestroyed) return;
    if (this.reconnectTimer) return; // Already scheduled

    this.state.reconnectAttempts++;
    this.state.consecutiveFailures++;

    // Calculate delay with exponential backoff
    const baseDelay = Math.min(
      this.config.initialReconnectDelay * Math.pow(2, this.state.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = this.config.jitter
      ? Math.random() * 0.3 * baseDelay // ±15% jitter
      : 0;

    const delay = Math.floor(baseDelay + jitter);

    logger.debug(`Scheduling reconnect in ${delay}ms (attempt ${this.state.reconnectAttempts})`);

    this.setState({ status: 'reconnecting' });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      // Check health before reconnecting
      if (this.config.healthCheckBeforeReconnect) {
        const health = await checkBackendHealth();
        if (!health.isHealthy) {
          logger.debug('Backend still unhealthy, will retry later');
          this.scheduleHealthCheck();
          return;
        }
      }

      await this.connect();
    }, delay);
  }

  /**
   * Schedule health check retry
   */
  private scheduleHealthCheck(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setTimeout(async () => {
      this.healthCheckTimer = null;
      const health = await checkBackendHealth();
      if (health.isHealthy) {
        await this.connect();
      } else {
        this.scheduleHealthCheck();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (error) {
          logger.warn('Failed to send ping:', error);
        }
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    this.state.consecutiveFailures++;
    this.config.onError(error);
    this.cleanup();
    
    if (!this.isDestroyed) {
      this.scheduleReconnect();
    }
  }

  /**
   * Send message (queue if not connected)
   */
  send(data: unknown): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        return true;
      } catch (error) {
        logger.error('Failed to send message:', error);
        this.messageQueue.push(data);
        return false;
      }
    } else {
      this.messageQueue.push(data);
      return false;
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          this.ws.send(JSON.stringify(message));
        } catch (error) {
          logger.error('Failed to flush queued message:', error);
          this.messageQueue.unshift(message); // Put it back
          break;
        }
      }
    }
  }

  /**
   * Update state and persist to localStorage
   */
  private setState(updates: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...updates };
    this.persistState();
  }

  /**
   * Persist connection state to localStorage
   */
  private persistState(): void {
    try {
      const key = `legendary_connection_${this.config.url}`;
      localStorage.setItem(key, JSON.stringify({
        reconnectAttempts: this.state.reconnectAttempts,
        lastConnectTime: this.state.lastConnectTime,
        lastDisconnectTime: this.state.lastDisconnectTime
      }));
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  /**
   * Restore connection state from localStorage
   */
  private restoreState(): void {
    try {
      const key = `legendary_connection_${this.config.url}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state.reconnectAttempts = parsed.reconnectAttempts || 0;
        this.state.lastConnectTime = parsed.lastConnectTime || null;
        this.state.lastDisconnectTime = parsed.lastDisconnectTime || null;
      }
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.healthCheckTimer) {
      clearTimeout(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.isDestroyed = true;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState({ status: 'disconnected' });
  }

  /**
   * Get connection status
   */
  get status(): ConnectionState['status'] {
    return this.state.status;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      ...this.state,
      isConnected: this.isConnected,
      queuedMessages: this.messageQueue.length
    };
  }
}
