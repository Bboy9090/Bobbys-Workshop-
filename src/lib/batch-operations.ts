/**
 * Batch Operations System
 * 
 * GOD MODE: Execute operations on multiple devices simultaneously.
 * Queue management, progress tracking, parallel execution.
 */

import { createLogger } from '@/lib/debug-logger';
import { UnifiedDevice } from '@/hooks/use-ultimate-device-manager';
import { OperationType, executeOperation, OPERATIONS, OperationResult } from '@/lib/secret-operations';
import { parseError, AppError } from '@/lib/error-handler';

const logger = createLogger('BatchOps');

// Batch operation state
export type BatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Single device operation in batch
export interface BatchDeviceOperation {
  deviceId: string;
  deviceSerial: string;
  deviceName: string;
  status: BatchStatus;
  progress: number; // 0-100
  startTime?: number;
  endTime?: number;
  result?: OperationResult;
  error?: AppError;
}

// Full batch operation
export interface BatchOperation {
  id: string;
  operationType: OperationType;
  operationName: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  status: BatchStatus;
  devices: BatchDeviceOperation[];
  options: BatchOptions;
  summary: BatchSummary;
}

// Batch options
export interface BatchOptions {
  maxConcurrent: number;          // Max parallel operations
  continueOnError: boolean;       // Continue if one fails
  delayBetweenOperations: number; // Delay in ms
  retryOnFailure: boolean;        // Retry failed operations
  maxRetries: number;             // Max retry attempts
}

// Batch summary
export interface BatchSummary {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  running: number;
  cancelled: number;
  successRate: number; // 0-1
  averageDuration: number;
  totalDuration: number;
}

// Event callbacks
type BatchEventCallback = (batch: BatchOperation) => void;
type DeviceEventCallback = (device: BatchDeviceOperation, batch: BatchOperation) => void;

/**
 * Batch Operations Manager
 */
class BatchOperationsManager {
  private activeBatches: Map<string, BatchOperation> = new Map();
  private batchListeners: Set<BatchEventCallback> = new Set();
  private deviceListeners: Set<DeviceEventCallback> = new Set();
  private isRunning = false;
  private abortControllers: Map<string, AbortController> = new Map();
  
  /**
   * Create a new batch operation
   */
  createBatch(
    operationType: OperationType,
    devices: UnifiedDevice[],
    options: Partial<BatchOptions> = {}
  ): BatchOperation {
    const operation = OPERATIONS[operationType];
    
    const batch: BatchOperation = {
      id: this.generateBatchId(),
      operationType,
      operationName: operation.name,
      createdAt: Date.now(),
      status: 'pending',
      devices: devices.map(d => ({
        deviceId: d.id,
        deviceSerial: d.serial || 'unknown',
        deviceName: d.displayName,
        status: 'pending',
        progress: 0,
      })),
      options: {
        maxConcurrent: 3,
        continueOnError: true,
        delayBetweenOperations: 500,
        retryOnFailure: false,
        maxRetries: 1,
        ...options,
      },
      summary: {
        total: devices.length,
        completed: 0,
        failed: 0,
        pending: devices.length,
        running: 0,
        cancelled: 0,
        successRate: 0,
        averageDuration: 0,
        totalDuration: 0,
      },
    };
    
    this.activeBatches.set(batch.id, batch);
    this.notifyBatch(batch);
    logger.info(`Created batch ${batch.id} with ${devices.length} devices`);
    
    return batch;
  }
  
  /**
   * Execute a batch operation
   */
  async executeBatch(
    batchId: string, 
    passcode: string
  ): Promise<BatchOperation> {
    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }
    
    if (batch.status !== 'pending') {
      throw new Error(`Batch ${batchId} is already ${batch.status}`);
    }
    
    // Setup abort controller
    const abortController = new AbortController();
    this.abortControllers.set(batchId, abortController);
    
    batch.status = 'running';
    batch.startedAt = Date.now();
    this.notifyBatch(batch);
    
    logger.info(`Starting batch ${batchId}`);
    
    try {
      // Process devices in chunks based on maxConcurrent
      const { maxConcurrent, delayBetweenOperations } = batch.options;
      
      for (let i = 0; i < batch.devices.length; i += maxConcurrent) {
        // Check if cancelled
        if (abortController.signal.aborted) {
          break;
        }
        
        const chunk = batch.devices.slice(i, i + maxConcurrent);
        
        // Execute chunk in parallel
        await Promise.all(
          chunk.map(device => this.executeDeviceOperation(batch, device, passcode))
        );
        
        // Update summary
        this.updateSummary(batch);
        this.notifyBatch(batch);
        
        // Delay before next chunk
        if (i + maxConcurrent < batch.devices.length && !abortController.signal.aborted) {
          await this.delay(delayBetweenOperations);
        }
      }
      
      // Final status
      if (abortController.signal.aborted) {
        batch.status = 'cancelled';
        // Mark remaining pending devices as cancelled
        batch.devices.forEach(d => {
          if (d.status === 'pending' || d.status === 'running') {
            d.status = 'cancelled';
          }
        });
      } else if (batch.summary.failed > 0 && batch.summary.completed === 0) {
        batch.status = 'failed';
      } else {
        batch.status = 'completed';
      }
      
      batch.completedAt = Date.now();
      batch.summary.totalDuration = batch.completedAt - (batch.startedAt || batch.createdAt);
      
      this.updateSummary(batch);
      this.notifyBatch(batch);
      
      logger.info(`Batch ${batchId} completed: ${batch.summary.completed}/${batch.summary.total} successful`);
      
    } catch (error) {
      batch.status = 'failed';
      batch.completedAt = Date.now();
      this.notifyBatch(batch);
      logger.error(`Batch ${batchId} failed`, error);
    } finally {
      this.abortControllers.delete(batchId);
    }
    
    return batch;
  }
  
  /**
   * Execute operation on a single device
   */
  private async executeDeviceOperation(
    batch: BatchOperation,
    device: BatchDeviceOperation,
    passcode: string
  ): Promise<void> {
    device.status = 'running';
    device.startTime = Date.now();
    device.progress = 10;
    
    this.notifyDevice(device, batch);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        if (device.progress < 90) {
          device.progress += 10;
          this.notifyDevice(device, batch);
        }
      }, 500);
      
      // Execute actual operation
      const result = await executeOperation(
        batch.operationType,
        device.deviceSerial,
        passcode
      );
      
      clearInterval(progressInterval);
      
      device.result = result;
      device.progress = 100;
      device.endTime = Date.now();
      device.status = result.success ? 'completed' : 'failed';
      
      if (!result.success) {
        device.error = parseError(new Error(result.error || 'Operation failed'));
      }
      
      this.notifyDevice(device, batch);
      
    } catch (error) {
      device.endTime = Date.now();
      device.status = 'failed';
      device.error = parseError(error);
      device.progress = 100;
      
      this.notifyDevice(device, batch);
      
      // Retry logic
      if (batch.options.retryOnFailure && !device.result) {
        // Could implement retry here
      }
    }
  }
  
  /**
   * Cancel a running batch
   */
  cancelBatch(batchId: string): void {
    const controller = this.abortControllers.get(batchId);
    if (controller) {
      controller.abort();
      logger.info(`Batch ${batchId} cancellation requested`);
    }
    
    const batch = this.activeBatches.get(batchId);
    if (batch && batch.status === 'pending') {
      batch.status = 'cancelled';
      batch.devices.forEach(d => {
        if (d.status === 'pending') {
          d.status = 'cancelled';
        }
      });
      this.updateSummary(batch);
      this.notifyBatch(batch);
    }
  }
  
  /**
   * Get batch by ID
   */
  getBatch(batchId: string): BatchOperation | undefined {
    return this.activeBatches.get(batchId);
  }
  
  /**
   * Get all active batches
   */
  getAllBatches(): BatchOperation[] {
    return Array.from(this.activeBatches.values());
  }
  
  /**
   * Remove completed batch
   */
  removeBatch(batchId: string): void {
    this.activeBatches.delete(batchId);
  }
  
  /**
   * Subscribe to batch updates
   */
  onBatchUpdate(callback: BatchEventCallback): () => void {
    this.batchListeners.add(callback);
    return () => this.batchListeners.delete(callback);
  }
  
  /**
   * Subscribe to device updates
   */
  onDeviceUpdate(callback: DeviceEventCallback): () => void {
    this.deviceListeners.add(callback);
    return () => this.deviceListeners.delete(callback);
  }
  
  // Private helpers
  
  private generateBatchId(): string {
    return `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  
  private updateSummary(batch: BatchOperation): void {
    const counts = batch.devices.reduce(
      (acc, d) => {
        acc[d.status]++;
        return acc;
      },
      { pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 }
    );
    
    const completed = batch.devices.filter(d => d.status === 'completed');
    const avgDuration = completed.length > 0
      ? completed.reduce((sum, d) => sum + ((d.endTime || 0) - (d.startTime || 0)), 0) / completed.length
      : 0;
    
    batch.summary = {
      total: batch.devices.length,
      ...counts,
      successRate: batch.devices.length > 0 
        ? counts.completed / (counts.completed + counts.failed) 
        : 0,
      averageDuration: avgDuration,
      totalDuration: batch.completedAt 
        ? batch.completedAt - (batch.startedAt || batch.createdAt)
        : Date.now() - (batch.startedAt || batch.createdAt),
    };
  }
  
  private notifyBatch(batch: BatchOperation): void {
    this.batchListeners.forEach(cb => cb(batch));
  }
  
  private notifyDevice(device: BatchDeviceOperation, batch: BatchOperation): void {
    this.deviceListeners.forEach(cb => cb(device, batch));
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const batchOperations = new BatchOperationsManager();

/**
 * Helper to create and start a batch operation
 */
export async function runBatchOperation(
  operationType: OperationType,
  devices: UnifiedDevice[],
  passcode: string,
  options?: Partial<BatchOptions>
): Promise<BatchOperation> {
  const batch = batchOperations.createBatch(operationType, devices, options);
  return batchOperations.executeBatch(batch.id, passcode);
}
