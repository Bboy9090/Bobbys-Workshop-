/**
 * Shared state and utilities for flash operations.
 * Production rule: this module never fabricates flash progress or success.
 */
export let flashHistory = [];
export let activeFlashJobs = new Map();
export let jobCounter = 1;

export function broadcastFlashProgress(jobId, data) {
  if (typeof global.flashProgressBroadcast === 'function') {
    global.flashProgressBroadcast(jobId, data);
  }
}

export function recordFlashHistory(entry) {
  flashHistory.unshift(entry);
  if (flashHistory.length > 50) {
    flashHistory = flashHistory.slice(0, 50);
  }
}
