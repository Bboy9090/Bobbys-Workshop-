/**
 * DFU Entry Instructions Guide
 * Device-specific instructions for entering DFU mode
 * Compliance: User must manually enter DFU mode - no automation
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { BookOpen, AlertTriangle, CheckCircle } from 'lucide-react';

interface DFUInstructionsGuideProps {
  deviceModel?: string;
  chip?: string;
  onClose?: () => void;
}

const deviceInstructions: Record<string, { steps: string[]; chip: string; models: string[] }> = {
  'iPhone X': {
    chip: 'A11',
    models: ['iPhone X'],
    steps: [
      'Connect your iPhone X to your computer via USB',
      'Open iTunes (Windows) or Finder (macOS)',
      'Press and hold the Volume Down button',
      'While holding Volume Down, press and hold the Side button',
      'Continue holding both buttons for 5 seconds',
      'Release the Side button but keep holding Volume Down',
      'Keep holding Volume Down for another 5 seconds',
      'Your device screen should be completely black',
      'iTunes/Finder should show "iPhone in Recovery Mode"'
    ]
  },
  'iPhone 8': {
    chip: 'A11',
    models: ['iPhone 8', 'iPhone 8 Plus'],
    steps: [
      'Connect your iPhone 8 to your computer via USB',
      'Open iTunes (Windows) or Finder (macOS)',
      'Press and hold the Volume Down button',
      'While holding Volume Down, press and hold the Side button',
      'Continue holding both buttons for 5 seconds',
      'Release the Side button but keep holding Volume Down',
      'Keep holding Volume Down for another 5 seconds',
      'Your device screen should be completely black',
      'iTunes/Finder should show "iPhone in Recovery Mode"'
    ]
  },
  'iPhone 11': {
    chip: 'A13',
    models: ['iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max'],
    steps: [
      'Connect your iPhone 11 to your computer via USB',
      'Open iTunes (Windows) or Finder (macOS)',
      'Quickly press and release the Volume Up button',
      'Quickly press and release the Volume Down button',
      'Press and hold the Side button',
      'Continue holding the Side button until the screen goes black',
      'Keep holding the Side button for another 5 seconds',
      'Your device screen should be completely black',
      'iTunes/Finder should show "iPhone in Recovery Mode"'
    ]
  },
  'iPhone 12': {
    chip: 'A14',
    models: ['iPhone 12', 'iPhone 12 mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max'],
    steps: [
      'Connect your iPhone 12 to your computer via USB',
      'Open iTunes (Windows) or Finder (macOS)',
      'Quickly press and release the Volume Up button',
      'Quickly press and release the Volume Down button',
      'Press and hold the Side button',
      'Continue holding the Side button until the screen goes black',
      'Keep holding the Side button for another 5 seconds',
      'Your device screen should be completely black',
      'iTunes/Finder should show "iPhone in Recovery Mode"'
    ]
  },
  'iPhone 13': {
    chip: 'A15',
    models: ['iPhone 13', 'iPhone 13 mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max'],
    steps: [
      'Connect your iPhone 13 to your computer via USB',
      'Open iTunes (Windows) or Finder (macOS)',
      'Quickly press and release the Volume Up button',
      'Quickly press and release the Volume Down button',
      'Press and hold the Side button',
      'Continue holding the Side button until the screen goes black',
      'Keep holding the Side button for another 5 seconds',
      'Your device screen should be completely black',
      'iTunes/Finder should show "iPhone in Recovery Mode"'
    ]
  },
  'iPhone 14': {
    chip: 'A15/A16',
    models: ['iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max'],
    steps: [
      'Connect your iPhone 14 to your computer via USB',
      'Open iTunes (Windows) or Finder (macOS)',
      'Quickly press and release the Volume Up button',
      'Quickly press and release the Volume Down button',
      'Press and hold the Side button',
      'Continue holding the Side button until the screen goes black',
      'Keep holding the Side button for another 5 seconds',
      'Your device screen should be completely black',
      'iTunes/Finder should show "iPhone in Recovery Mode"'
    ]
  },
  'iPhone 15': {
    chip: 'A16/A17',
    models: ['iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max'],
    steps: [
      'Connect your iPhone 15 to your computer via USB',
      'Open iTunes (Windows) or Finder (macOS)',
      'Quickly press and release the Volume Up button',
      'Quickly press and release the Volume Down button',
      'Press and hold the Side button (or Action button on Pro models)',
      'Continue holding until the screen goes black',
      'Keep holding for another 5 seconds',
      'Your device screen should be completely black',
      'iTunes/Finder should show "iPhone in Recovery Mode"'
    ]
  }
};

export const DFUInstructionsGuide: React.FC<DFUInstructionsGuideProps> = ({ deviceModel, chip, onClose }) => {
  // Determine which instructions to show based on device model or chip
  let instructions = null;
  
  if (deviceModel) {
    // Try to match by model name
    const modelKey = Object.keys(deviceInstructions).find(key => 
      deviceInstructions[key].models.some(m => deviceModel.includes(m))
    );
    if (modelKey) {
      instructions = deviceInstructions[modelKey];
    }
  }
  
  if (!instructions && chip) {
    // Match by chip if model not found
    const chipKey = Object.keys(deviceInstructions).find(key => 
      deviceInstructions[key].chip === chip
    );
    if (chipKey) {
      instructions = deviceInstructions[chipKey];
    }
  }
  
  // Default to iPhone X/8 instructions if no match
  if (!instructions) {
    instructions = deviceInstructions['iPhone X'];
  }

  return (
    <Card className="bg-[#0B0F14] border-[#2FD3FF]/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#2FD3FF]" />
            <CardTitle className="text-white">DFU Mode Entry Instructions</CardTitle>
          </div>
          {chip && <Badge variant="outline">{chip}</Badge>}
        </div>
        <CardDescription className="text-gray-400">
          Follow these steps to manually enter DFU mode. This cannot be automated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-[#0B0F14] border-[#FF6B9D]/50">
          <AlertTriangle className="h-4 w-4 text-[#FF6B9D]" />
          <AlertDescription className="text-gray-300 text-sm">
            <strong className="text-[#FF6B9D]">Compliance Note:</strong> DFU entry requires physical button presses 
            and cannot be automated. You must manually follow these steps.
          </AlertDescription>
        </Alert>

        {deviceModel && (
          <div className="text-sm text-gray-300">
            <strong>Device:</strong> {deviceModel} {chip && `(${chip})`}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300">Step-by-Step Instructions:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
            {instructions.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-[#2FD3FF] font-medium">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50">
          <CheckCircle className="h-4 w-4 text-[#2FD3FF]" />
          <AlertDescription className="text-gray-300 text-sm">
            <strong>Success Indicators:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
              <li>Device screen is completely black (not showing Apple logo)</li>
              <li>iTunes/Finder shows "iPhone in Recovery Mode"</li>
              <li>Device is detected by libimobiledevice tools</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="text-xs text-gray-500 pt-2 border-t border-[#2FD3FF]/20">
          <strong>Note:</strong> If you see the Apple logo or recovery mode screen, you're in Recovery Mode, not DFU mode. 
          Release the buttons and try again.
        </div>
      </CardContent>
    </Card>
  );
};
