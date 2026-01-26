/**
 * Global Error Handler
 * 
 * GOD MODE: Bulletproof error handling that never crashes the app.
 * Graceful degradation, user-friendly messages, automatic recovery.
 */

import { createLogger } from '@/lib/debug-logger';

const logger = createLogger('ErrorHandler');

// Error types
export type ErrorType = 
  | 'network'
  | 'api'
  | 'validation'
  | 'device'
  | 'permission'
  | 'timeout'
  | 'unknown';

// Structured error
export interface AppError {
  type: ErrorType;
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  context?: Record<string, unknown>;
  originalError?: Error;
  timestamp: number;
}

// Error codes
export const ERROR_CODES = {
  // Network errors
  NETWORK_OFFLINE: 'NET_001',
  NETWORK_TIMEOUT: 'NET_002',
  NETWORK_FAILED: 'NET_003',
  
  // API errors
  API_UNAUTHORIZED: 'API_001',
  API_FORBIDDEN: 'API_002',
  API_NOT_FOUND: 'API_003',
  API_VALIDATION: 'API_004',
  API_SERVER_ERROR: 'API_005',
  API_RATE_LIMITED: 'API_006',
  
  // Device errors
  DEVICE_NOT_CONNECTED: 'DEV_001',
  DEVICE_UNAUTHORIZED: 'DEV_002',
  DEVICE_BUSY: 'DEV_003',
  DEVICE_NOT_FOUND: 'DEV_004',
  DEVICE_INCOMPATIBLE: 'DEV_005',
  
  // Operation errors
  OP_FAILED: 'OP_001',
  OP_CANCELLED: 'OP_002',
  OP_TIMEOUT: 'OP_003',
  OP_UNSUPPORTED: 'OP_004',
  
  // Permission errors
  PERM_DENIED: 'PERM_001',
  PERM_REQUIRED: 'PERM_002',
  
  // Unknown
  UNKNOWN: 'UNK_001',
} as const;

// User-friendly messages
const USER_MESSAGES: Record<string, string> = {
  [ERROR_CODES.NETWORK_OFFLINE]: 'You appear to be offline. Please check your internet connection.',
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ERROR_CODES.NETWORK_FAILED]: 'Network request failed. Please check your connection.',
  
  [ERROR_CODES.API_UNAUTHORIZED]: 'Authentication required. Please enter your credentials.',
  [ERROR_CODES.API_FORBIDDEN]: 'Access denied. You don\'t have permission for this action.',
  [ERROR_CODES.API_NOT_FOUND]: 'Resource not found. Please try refreshing the page.',
  [ERROR_CODES.API_VALIDATION]: 'Invalid input. Please check your data and try again.',
  [ERROR_CODES.API_SERVER_ERROR]: 'Server error. Our team has been notified.',
  [ERROR_CODES.API_RATE_LIMITED]: 'Too many requests. Please wait a moment.',
  
  [ERROR_CODES.DEVICE_NOT_CONNECTED]: 'Device not connected. Please connect your device via USB.',
  [ERROR_CODES.DEVICE_UNAUTHORIZED]: 'Device not authorized. Please accept the USB debugging prompt on your device.',
  [ERROR_CODES.DEVICE_BUSY]: 'Device is busy with another operation. Please wait.',
  [ERROR_CODES.DEVICE_NOT_FOUND]: 'Device not found. Please reconnect your device.',
  [ERROR_CODES.DEVICE_INCOMPATIBLE]: 'Device is not compatible with this operation.',
  
  [ERROR_CODES.OP_FAILED]: 'Operation failed. Please try again.',
  [ERROR_CODES.OP_CANCELLED]: 'Operation was cancelled.',
  [ERROR_CODES.OP_TIMEOUT]: 'Operation timed out. Please try again.',
  [ERROR_CODES.OP_UNSUPPORTED]: 'This operation is not supported for your device.',
  
  [ERROR_CODES.PERM_DENIED]: 'Permission denied. Please check app permissions.',
  [ERROR_CODES.PERM_REQUIRED]: 'Additional permissions required.',
  
  [ERROR_CODES.UNKNOWN]: 'An unexpected error occurred. Please try again.',
};

/**
 * Parse error from various sources into structured AppError
 */
export function parseError(error: unknown, context?: Record<string, unknown>): AppError {
  const timestamp = Date.now();
  
  // Already an AppError
  if (isAppError(error)) {
    return { ...error, context: { ...error.context, ...context } };
  }
  
  // Network/Fetch error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      code: ERROR_CODES.NETWORK_FAILED,
      message: error.message,
      userMessage: USER_MESSAGES[ERROR_CODES.NETWORK_FAILED],
      recoverable: true,
      retryable: true,
      context,
      originalError: error,
      timestamp,
    };
  }
  
  // Response error (from API)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return parseResponseError(status, error as Record<string, unknown>, context);
  }
  
  // Standard Error
  if (error instanceof Error) {
    // Check for specific error patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
      return {
        type: 'timeout',
        code: ERROR_CODES.NETWORK_TIMEOUT,
        message: error.message,
        userMessage: USER_MESSAGES[ERROR_CODES.NETWORK_TIMEOUT],
        recoverable: true,
        retryable: true,
        context,
        originalError: error,
        timestamp,
      };
    }
    
    if (message.includes('network') || message.includes('offline')) {
      return {
        type: 'network',
        code: ERROR_CODES.NETWORK_OFFLINE,
        message: error.message,
        userMessage: USER_MESSAGES[ERROR_CODES.NETWORK_OFFLINE],
        recoverable: true,
        retryable: true,
        context,
        originalError: error,
        timestamp,
      };
    }
    
    if (message.includes('permission') || message.includes('access')) {
      return {
        type: 'permission',
        code: ERROR_CODES.PERM_DENIED,
        message: error.message,
        userMessage: USER_MESSAGES[ERROR_CODES.PERM_DENIED],
        recoverable: false,
        retryable: false,
        context,
        originalError: error,
        timestamp,
      };
    }
    
    return {
      type: 'unknown',
      code: ERROR_CODES.UNKNOWN,
      message: error.message,
      userMessage: USER_MESSAGES[ERROR_CODES.UNKNOWN],
      recoverable: true,
      retryable: true,
      context,
      originalError: error,
      timestamp,
    };
  }
  
  // String error
  if (typeof error === 'string') {
    return {
      type: 'unknown',
      code: ERROR_CODES.UNKNOWN,
      message: error,
      userMessage: error,
      recoverable: true,
      retryable: true,
      context,
      timestamp,
    };
  }
  
  // Unknown error type
  return {
    type: 'unknown',
    code: ERROR_CODES.UNKNOWN,
    message: 'Unknown error occurred',
    userMessage: USER_MESSAGES[ERROR_CODES.UNKNOWN],
    recoverable: true,
    retryable: true,
    context,
    timestamp,
  };
}

/**
 * Parse HTTP response status to error
 */
function parseResponseError(
  status: number, 
  response: Record<string, unknown>,
  context?: Record<string, unknown>
): AppError {
  const timestamp = Date.now();
  const message = (response.message as string) || (response.error as string) || 'Request failed';
  
  const statusErrors: Record<number, { code: string; type: ErrorType; recoverable: boolean; retryable: boolean }> = {
    400: { code: ERROR_CODES.API_VALIDATION, type: 'validation', recoverable: true, retryable: false },
    401: { code: ERROR_CODES.API_UNAUTHORIZED, type: 'api', recoverable: true, retryable: false },
    403: { code: ERROR_CODES.API_FORBIDDEN, type: 'permission', recoverable: false, retryable: false },
    404: { code: ERROR_CODES.API_NOT_FOUND, type: 'api', recoverable: true, retryable: false },
    429: { code: ERROR_CODES.API_RATE_LIMITED, type: 'api', recoverable: true, retryable: true },
    500: { code: ERROR_CODES.API_SERVER_ERROR, type: 'api', recoverable: true, retryable: true },
    502: { code: ERROR_CODES.API_SERVER_ERROR, type: 'api', recoverable: true, retryable: true },
    503: { code: ERROR_CODES.API_SERVER_ERROR, type: 'api', recoverable: true, retryable: true },
    504: { code: ERROR_CODES.NETWORK_TIMEOUT, type: 'timeout', recoverable: true, retryable: true },
  };
  
  const config = statusErrors[status] || { 
    code: ERROR_CODES.UNKNOWN, 
    type: 'unknown' as ErrorType, 
    recoverable: true, 
    retryable: true 
  };
  
  return {
    type: config.type,
    code: config.code,
    message,
    userMessage: USER_MESSAGES[config.code] || message,
    recoverable: config.recoverable,
    retryable: config.retryable,
    context: { ...context, status, response },
    timestamp,
  };
}

/**
 * Check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'code' in error &&
    'userMessage' in error
  );
}

/**
 * Log error with context
 */
export function logError(error: AppError): void {
  logger.error(`[${error.code}] ${error.message}`, {
    type: error.type,
    recoverable: error.recoverable,
    context: error.context,
  });
}

/**
 * Error store for tracking recent errors
 */
class ErrorStore {
  private errors: AppError[] = [];
  private maxErrors = 100;
  private listeners: Set<(errors: AppError[]) => void> = new Set();
  
  add(error: AppError): void {
    this.errors.unshift(error);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }
    this.notify();
  }
  
  getAll(): AppError[] {
    return [...this.errors];
  }
  
  getRecent(count = 10): AppError[] {
    return this.errors.slice(0, count);
  }
  
  clear(): void {
    this.errors = [];
    this.notify();
  }
  
  subscribe(listener: (errors: AppError[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify(): void {
    this.listeners.forEach(l => l(this.errors));
  }
}

export const errorStore = new ErrorStore();

/**
 * Safe async wrapper that catches and handles errors
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (error: AppError) => void;
    fallback?: T;
    retries?: number;
    retryDelay?: number;
    context?: Record<string, unknown>;
  }
): Promise<{ success: true; data: T } | { success: false; error: AppError }> {
  const { onError, fallback, retries = 0, retryDelay = 1000, context } = options || {};
  let lastError: AppError | undefined;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (e) {
      lastError = parseError(e, { ...context, attempt });
      logError(lastError);
      
      if (attempt < retries && lastError.retryable) {
        await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
      }
    }
  }
  
  const error = lastError!;
  errorStore.add(error);
  onError?.(error);
  
  if (fallback !== undefined) {
    return { success: true, data: fallback };
  }
  
  return { success: false, error };
}

/**
 * Retry helper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e as Error;
      if (i < maxRetries) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(message)), timeoutMs)
    )
  ]);
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandler(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = parseError(event.reason, { source: 'unhandledrejection' });
    logError(error);
    errorStore.add(error);
    
    // Prevent default browser error logging
    event.preventDefault();
  });
  
  // Handle uncaught exceptions
  window.addEventListener('error', (event) => {
    const error = parseError(event.error || event.message, { 
      source: 'error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    logError(error);
    errorStore.add(error);
  });
  
  logger.info('Global error handler initialized');
}
