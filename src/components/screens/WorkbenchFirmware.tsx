/**
 * WorkbenchFirmware
 * 
 * Library + search/download
 */

import React from 'react';
import { FirmwareLibrary } from '@/components/FirmwareLibrary';

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
