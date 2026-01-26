/**
 * WorkbenchFirmware
 * 
 * Library + search/download
 */

import React from 'react';
import { FirmwareLibrary } from '@/components/FirmwareLibrary';

/**
 * Render the Firmware workbench view with a header and the embedded firmware library.
 *
 * @returns The component's JSX: a titled header ("Firmware" and subtitle) followed by the <FirmwareLibrary /> view.
 */
export function WorkbenchFirmware() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary font-mono mb-2">
          Firmware
        </h1>
        <p className="text-sm text-ink-muted">
          Firmware library, search, and download
        </p>
      </div>
      <FirmwareLibrary />
    </div>
  );
}