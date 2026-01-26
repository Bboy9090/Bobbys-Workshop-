/**
 * Advanced Notification System
 * 
 * GOD MODE: Smart notifications with persistence, grouping, and actions.
 * Never miss an important event, always stay informed.
 */

import { toast } from 'sonner';
import { createLogger } from '@/lib/debug-logger';

const logger = createLogger('Notifications');

// Notification types
export type NotificationType = 
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'device_connected'
  | 'device_disconnected'
  | 'operation_complete'
  | 'operation_failed'
  | 'flash_progress'
  | 'security_alert';

// Notification priority
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Notification action
export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

// Notification config
export interface NotificationConfig {
  id?: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  duration?: number; // ms, 0 for persistent
  actions?: NotificationAction[];
  icon?: string;
  sound?: boolean;
  group?: string;
  data?: Record<string, unknown>;
}

// Stored notification
export interface StoredNotification extends NotificationConfig {
  id: string;
  timestamp: number;
  read: boolean;
  dismissed: boolean;
}

// Notification store
class NotificationStore {
  private notifications: StoredNotification[] = [];
  private maxNotifications = 100;
  private listeners: Set<(notifications: StoredNotification[]) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('bw:notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (e) {
      logger.warn('Failed to load notifications from storage', e);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('bw:notifications', JSON.stringify(this.notifications));
    } catch (e) {
      logger.warn('Failed to save notifications to storage', e);
    }
  }

  add(config: NotificationConfig): StoredNotification {
    const notification: StoredNotification = {
      ...config,
      id: config.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      read: false,
      dismissed: false,
    };

    this.notifications.unshift(notification);
    
    // Trim old notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    this.saveToStorage();
    this.notify();
    return notification;
  }

  markAsRead(id: string): void {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.saveToStorage();
      this.notify();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => { n.read = true; });
    this.saveToStorage();
    this.notify();
  }

  dismiss(id: string): void {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) {
      notif.dismissed = true;
      this.saveToStorage();
      this.notify();
    }
  }

  clear(): void {
    this.notifications = [];
    this.saveToStorage();
    this.notify();
  }

  getAll(): StoredNotification[] {
    return this.notifications.filter(n => !n.dismissed);
  }

  getUnread(): StoredNotification[] {
    return this.notifications.filter(n => !n.read && !n.dismissed);
  }

  getUnreadCount(): number {
    return this.getUnread().length;
  }

  subscribe(callback: (notifications: StoredNotification[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb(this.getAll()));
  }
}

export const notificationStore = new NotificationStore();

// Duration presets
const DURATIONS: Record<NotificationPriority, number> = {
  low: 3000,
  normal: 5000,
  high: 8000,
  urgent: 0, // Persistent
};

// Icon mappings
const ICONS: Record<NotificationType, string> = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠️',
  error: '❌',
  device_connected: '📱',
  device_disconnected: '📴',
  operation_complete: '✨',
  operation_failed: '💥',
  flash_progress: '⚡',
  security_alert: '🔒',
};

/**
 * Show a notification
 */
export function notify(config: NotificationConfig): void {
  const { 
    type, 
    title, 
    message, 
    priority = 'normal',
    duration = DURATIONS[priority],
    actions,
    sound = priority === 'high' || priority === 'urgent',
  } = config;

  // Store notification
  notificationStore.add(config);

  // Show toast
  const toastConfig = {
    duration: duration === 0 ? Infinity : duration,
    description: message,
    action: actions && actions.length > 0 ? {
      label: actions[0].label,
      onClick: actions[0].onClick,
    } : undefined,
  };

  switch (type) {
    case 'success':
    case 'operation_complete':
      toast.success(title, toastConfig);
      break;
    case 'error':
    case 'operation_failed':
    case 'security_alert':
      toast.error(title, toastConfig);
      break;
    case 'warning':
      toast.warning(title, toastConfig);
      break;
    case 'device_connected':
      toast.success(`${ICONS.device_connected} ${title}`, toastConfig);
      break;
    case 'device_disconnected':
      toast.info(`${ICONS.device_disconnected} ${title}`, toastConfig);
      break;
    default:
      toast.info(title, toastConfig);
  }

  // Play sound for high priority
  if (sound && typeof window !== 'undefined') {
    playNotificationSound(type);
  }

  logger.debug(`Notification: [${type}] ${title}`);
}

/**
 * Play notification sound
 */
function playNotificationSound(type: NotificationType): void {
  // Could integrate with soundManager here
  // For now, just log
  logger.debug(`Would play sound for ${type}`);
}

// Convenience functions
export const notifySuccess = (title: string, message: string) => 
  notify({ type: 'success', title, message });

export const notifyError = (title: string, message: string) => 
  notify({ type: 'error', title, message, priority: 'high' });

export const notifyWarning = (title: string, message: string) => 
  notify({ type: 'warning', title, message });

export const notifyInfo = (title: string, message: string) => 
  notify({ type: 'info', title, message });

export const notifyDeviceConnected = (deviceName: string) =>
  notify({ 
    type: 'device_connected', 
    title: 'Device Connected', 
    message: deviceName,
    group: 'devices',
  });

export const notifyDeviceDisconnected = (deviceName: string) =>
  notify({ 
    type: 'device_disconnected', 
    title: 'Device Disconnected', 
    message: deviceName,
    group: 'devices',
  });

export const notifyOperationComplete = (operation: string, deviceName: string) =>
  notify({ 
    type: 'operation_complete', 
    title: `${operation} Complete`, 
    message: `Successfully completed on ${deviceName}`,
    priority: 'high',
    group: 'operations',
  });

export const notifyOperationFailed = (operation: string, error: string) =>
  notify({ 
    type: 'operation_failed', 
    title: `${operation} Failed`, 
    message: error,
    priority: 'urgent',
    group: 'operations',
  });

export const notifySecurityAlert = (title: string, message: string) =>
  notify({ 
    type: 'security_alert', 
    title, 
    message,
    priority: 'urgent',
    sound: true,
  });
