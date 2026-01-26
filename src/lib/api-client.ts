/**
 * Unified API Client
 * 
 * Single source for all API calls with:
 * - Envelope parsing ({ok, data, meta})
 * - Error normalization (show real reason)
 * - Retry logic (safe requests only)
 * - Timeout & cancellation (AbortController)
 * 
 * NO MOCKS - production only.
 */

import { getAPIUrl } from './apiConfig';
import { parseEnvelope, type ApiResponse, type ApiError } from './api-envelope';

export interface ApiClientOptions extends RequestInit {
  timeout?: number; // milliseconds, default 30000
  retries?: number; // default 0, only for GET requests
  retryDelay?: number; // milliseconds, default 1000
  showErrors?: boolean; // default true
}

export interface ApiClientResult<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    warnings?: string[];
  };
}

/**
 * Check if request method is safe for retries
 */
function isSafeMethod(method?: string): boolean {
  return !method || method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Unified API client function
 */
export async function apiClient<T = any>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiClientResult<T>> {
  const {
    timeout = 30000,
    retries = 0,
    retryDelay = 1000,
    showErrors = true,
    ...fetchOptions
  } = options;

  const method = fetchOptions.method || 'GET';
  const isSafe = isSafeMethod(method);
  const maxRetries = isSafe ? retries : 0; // Only retry safe methods

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Exponential backoff for retries
    if (attempt > 0) {
      await sleep(retryDelay * Math.pow(2, attempt - 1));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(getAPIUrl(endpoint), {
        ...fetchOptions,
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      // Parse envelope
      const envelope = await parseEnvelope<T>(response);

      // Normalize error
      if (!envelope.ok) {
        const error: ApiError = envelope as ApiError;
        
        // Show actionable error message
        if (showErrors && attempt === maxRetries) {
          console.error('[apiClient] Request failed:', {
            endpoint,
            error: error.error,
            meta: error.meta,
          });
        }

        return {
          ok: false,
          error: {
            code: error.error?.code || 'API_ERROR',
            message: error.error?.message || 'Request failed',
            details: error.error?.details,
          },
          meta: error.meta ? {
            timestamp: error.meta.ts || new Date().toISOString(),
            requestId: error.meta.correlationId || '',
            warnings: error.meta.warnings,
          } : undefined,
        };
      }

      // Success
      return {
        ok: true,
        data: envelope.data,
        meta: envelope.meta ? {
          timestamp: envelope.meta.ts || new Date().toISOString(),
          requestId: envelope.meta.correlationId || '',
          warnings: envelope.meta.warnings,
        } : undefined,
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        lastError = error;

        // Abort errors are not retryable
        if (error.name === 'AbortError') {
          return {
            ok: false,
            error: {
              code: 'TIMEOUT',
              message: `Request timed out after ${timeout}ms`,
            },
          };
        }

        // Network errors are retryable (if safe method)
        if (isSafe && attempt < maxRetries) {
          continue; // Retry
        }

        // Final attempt failed
        if (showErrors && attempt === maxRetries) {
          console.error('[apiClient] Network error:', {
            endpoint,
            error: error.message,
            attempts: attempt + 1,
          });
        }

        return {
          ok: false,
          error: {
            code: 'NETWORK_ERROR',
            message: error.message || 'Network request failed',
          },
        };
      }

      // Unknown error
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred',
        },
      };
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    ok: false,
    error: {
      code: 'MAX_RETRIES_EXCEEDED',
      message: lastError?.message || 'Request failed after all retries',
    },
  };
}

/**
 * Convenience methods
 */
export const api = {
  get: <T = any>(endpoint: string, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};
