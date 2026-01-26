/**
 * Shared state and utilities for flash operations
 * Used by both v1 flash router and legacy endpoints during migration
 */

// Flash job storage (in-memory for now - in production would use database)
export let flashHistory = [];
export let activeFlashJobs = new Map();
export let jobCounter = 1;

/**
 * Determines whether flash simulation is permitted based on runtime config or environment.
 * @param {{simulate?: boolean}} [config] - Optional runtime configuration; the `simulate` property enables simulation when true.
 * @returns {boolean} `true` if simulation is allowed (config.simulate is true or the FLASH_SIMULATION environment variable equals 'true'), `false` otherwise.
 */
export function isFlashSimulationAllowed(config = {}) {
  return config?.simulate === true || process.env.FLASH_SIMULATION === 'true';
}

/**
 * Broadcast flash progress to WebSocket clients
 */
export function broadcastFlashProgress(jobId, data) {
  // Import WebSocket server dynamically to avoid circular dependencies
  // This will be injected by server/index.js
  if (typeof global.flashProgressBroadcast === 'function') {
    global.flashProgressBroadcast(jobId, data);
  }
}

/**
 * Simulates a flash job's progress and lifecycle for testing or demo purposes.
 *
 * Simulates periodic progress updates, step transitions between partitions, completion,
 * and appends a summary record to in-memory flash history; broadcasts progress via the
 * global broadcast hook and removes the job shortly after completion.
 *
 * @param {string} jobId - Identifier of the flash job to simulate (must exist in activeFlashJobs).
 * @param {Object} config - Simulation configuration and device metadata.
 * @param {Array<{name: string}>} config.partitions - Array of partitions to flash (each must have a `name`).
 * @param {string} [config.deviceSerial] - Device serial number to record in flash history.
 * @param {string} [config.deviceBrand] - Device brand to record in flash history.
 * @param {string} [config.flashMethod] - Flash method name to record in flash history.
 * @throws {Error} If flash simulation is not allowed (FLASH_SIMULATION not enabled and config.simulate is not true).
 */
export function simulateFlashOperation(jobId, config) {
  if (!isFlashSimulationAllowed(config)) {
    throw new Error('Flash simulation is disabled. Set FLASH_SIMULATION=true or pass simulate=true.');
  }

  const job = activeFlashJobs.get(jobId);
  if (!job) return;
  
  job.status.status = 'running';
  job.status.logs.push(`[${new Date().toISOString()}] Starting flash operation`);
  job.status.currentStep = `Flashing ${config.partitions[0].name}`;
  
  broadcastFlashProgress(jobId, {
    type: 'progress',
    status: job.status
  });
  
  let stepIndex = 0;
  const stepInterval = setInterval(() => {
    const job = activeFlashJobs.get(jobId);
    if (!job) {
      clearInterval(stepInterval);
      return;
    }
    
    job.status.progress += 10;
    job.status.timeElapsed = Math.floor((Date.now() - job.status.startTime) / 1000);
    job.status.speed = Math.floor(Math.random() * 20 + 10);
    
    if (job.status.progress >= 100) {
      job.status.progress = 100;
      job.status.status = 'completed';
      job.status.currentStep = 'Completed';
      job.status.logs.push(`[${new Date().toISOString()}] Flash operation completed successfully`);
      
      flashHistory.unshift({
        jobId,
        deviceSerial: config.deviceSerial,
        deviceBrand: config.deviceBrand,
        flashMethod: config.flashMethod,
        partitions: config.partitions.map(p => p.name),
        status: 'completed',
        startTime: job.status.startTime,
        endTime: Date.now(),
        duration: Math.floor((Date.now() - job.status.startTime) / 1000),
        bytesWritten: job.status.totalBytes,
        averageSpeed: Math.floor(Math.random() * 20 + 10)
      });
      
      if (flashHistory.length > 50) {
        flashHistory = flashHistory.slice(0, 50);
      }
      
      broadcastFlashProgress(jobId, {
        type: 'completed',
        status: job.status
      });
      
      clearInterval(stepInterval);
      setTimeout(() => activeFlashJobs.delete(jobId), 5000);
    } else if (job.status.progress % 30 === 0 && stepIndex < config.partitions.length - 1) {
      stepIndex++;
      job.status.completedSteps = stepIndex;
      job.status.currentStep = `Flashing ${config.partitions[stepIndex].name}`;
      job.status.logs.push(`[${new Date().toISOString()}] Flashing partition: ${config.partitions[stepIndex].name}`);
    }
    
    broadcastFlashProgress(jobId, {
      type: 'progress',
      status: job.status
    });
  }, 1000);
}
