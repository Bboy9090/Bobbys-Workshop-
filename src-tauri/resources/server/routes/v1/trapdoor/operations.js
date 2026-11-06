/**
 * Trapdoor Operations Handlers
 * 
 * Re-exports the canonical Trapdoor Admin Architecture operation handlers
 * from server/routes/v1/trapdoor/operations.js for the Tauri bundled server.
 * 
 * @module src-tauri/resources/server/routes/v1/trapdoor/operations
 */

export {
  executeHandler,
  simulateHandler,
  listOperationsHandler
} from '../../../../../../server/routes/v1/trapdoor/operations.js';
