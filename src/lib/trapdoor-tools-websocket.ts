/**
 * Trapdoor Tools WebSocket Client
 * 
 * Real-time tool output streaming via WebSocket
 */

import { io, Socket } from 'socket.io-client';

export interface ToolOutputMessage {
  session_id: string;
  type: 'start' | 'stdout' | 'stderr' | 'end' | 'error';
  message: string;
  exit_code?: number;
}

export type ToolOutputCallback = (message: ToolOutputMessage) => void;

const TRAPDOOR_API_URL = process.env.TRAPDOOR_API_URL || 'http://localhost:5001';

export class TrapdoorToolsWebSocket {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private callbacks: Map<string, ToolOutputCallback[]> = new Map();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(TRAPDOOR_API_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('[TrapdoorWebSocket] Connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('[TrapdoorWebSocket] Connection error:', error);
        reject(error);
      });

      this.socket.on('connected', (data: any) => {
        console.log('[TrapdoorWebSocket]', data.message);
      });

      this.socket.on('tool_output', (message: ToolOutputMessage) => {
        const callbacks = this.callbacks.get(message.session_id) || [];
        callbacks.forEach(cb => cb(message));
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.callbacks.clear();
    this.sessionId = null;
  }

  createSession(): string {
    this.sessionId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.sessionId;
  }

  joinSession(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('join_session', { session_id: sessionId }, (response: any) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });

      this.socket.once('joined', (data: any) => {
        if (data.session_id === sessionId) {
          resolve();
        }
      });
    });
  }

  onToolOutput(sessionId: string, callback: ToolOutputCallback): () => void {
    if (!this.callbacks.has(sessionId)) {
      this.callbacks.set(sessionId, []);
    }
    this.callbacks.get(sessionId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.callbacks.get(sessionId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Singleton instance
let wsInstance: TrapdoorToolsWebSocket | null = null;

export function getTrapdoorWebSocket(): TrapdoorToolsWebSocket {
  if (!wsInstance) {
    wsInstance = new TrapdoorToolsWebSocket();
  }
  return wsInstance;
}
