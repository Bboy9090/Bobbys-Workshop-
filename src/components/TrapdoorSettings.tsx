/**
 * Trapdoor Settings Component
 * 
 * Manage Trapdoor API authentication and preferences
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Shield, Key, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const TrapdoorSettings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [defaultTimeout, setDefaultTimeout] = useState(30000);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [logRetention, setLogRetention] = useState(90);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved settings
    const savedApiKey = localStorage.getItem('trapdoor-api-key') || '';
    const savedPasscode = localStorage.getItem('trapdoor-passcode') || '';
    const savedTimeout = parseInt(localStorage.getItem('trapdoor-timeout') || '30000', 10);
    const savedAutoConfirm = localStorage.getItem('trapdoor-auto-confirm') === 'true';
    const savedRetention = parseInt(localStorage.getItem('trapdoor-log-retention') || '90', 10);

    setApiKey(savedApiKey);
    setPasscode(savedPasscode);
    setDefaultTimeout(savedTimeout);
    setAutoConfirm(savedAutoConfirm);
    setLogRetention(savedRetention);
  }, []);

  const handleSave = () => {
    localStorage.setItem('trapdoor-api-key', apiKey);
    localStorage.setItem('trapdoor-passcode', passcode);
    localStorage.setItem('trapdoor-timeout', defaultTimeout.toString());
    localStorage.setItem('trapdoor-auto-confirm', autoConfirm.toString());
    localStorage.setItem('trapdoor-log-retention', logRetention.toString());

    setSaved(true);
    toast.success('Trapdoor settings saved');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    try {
      const testPasscode = passcode || apiKey;
      const response = await fetch('/api/v1/trapdoor/operations', {
        headers: {
          'X-Secret-Room-Passcode': testPasscode,
          'X-API-Key': apiKey
        }
      });

      if (response.ok) {
        toast.success('Connection test successful');
      } else {
        toast.error('Connection test failed');
      }
    } catch (error) {
      toast.error('Connection test error');
    }
  };

  return (
    <Card className="bg-[#141922] border-[#2FD3FF]/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#2FD3FF]" />
          <CardTitle className="text-white">Trapdoor Settings</CardTitle>
        </div>
        <CardDescription className="text-gray-400">
          Configure Trapdoor API authentication and operation preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Authentication */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-[#2FD3FF]" />
            Authentication
          </h3>

          <div className="space-y-2">
            <Label className="text-white">API Key</Label>
            <Input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key"
              className="bg-[#0B0F14] border-[#2FD3FF]/50"
            />
            <p className="text-xs text-gray-500">
              Alternative authentication method (optional)
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Secret Room Passcode</Label>
            <div className="relative">
              <Input
                type={showPasscode ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter Secret Room passcode"
                className="bg-[#0B0F14] border-[#2FD3FF]/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Required for accessing Secret Rooms
            </p>
          </div>

          <Button
            onClick={handleTestConnection}
            variant="outline"
            className="border-[#2FD3FF]/50 text-[#2FD3FF] hover:bg-[#2FD3FF]/10"
          >
            Test Connection
          </Button>
        </div>

        {/* Operation Preferences */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold">Operation Preferences</h3>

          <div className="space-y-2">
            <Label className="text-white">Default Timeout (ms)</Label>
            <Input
              type="number"
              value={defaultTimeout}
              onChange={(e) => setDefaultTimeout(parseInt(e.target.value, 10))}
              min={1000}
              max={300000}
              className="bg-[#0B0F14] border-[#2FD3FF]/50"
            />
            <p className="text-xs text-gray-500">
              Default timeout for operations (1000-300000 ms)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-confirm"
              checked={autoConfirm}
              onChange={(e) => setAutoConfirm(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="auto-confirm" className="text-white cursor-pointer">
              Auto-confirm low-risk operations
            </Label>
          </div>
        </div>

        {/* Shadow Log Settings */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold">Shadow Log Settings</h3>

          <div className="space-y-2">
            <Label className="text-white">Log Retention (days)</Label>
            <Input
              type="number"
              value={logRetention}
              onChange={(e) => setLogRetention(parseInt(e.target.value, 10))}
              min={1}
              max={365}
              className="bg-[#0B0F14] border-[#2FD3FF]/50"
            />
            <p className="text-xs text-gray-500">
              How long to retain shadow logs (1-365 days)
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-4 border-t border-[#2FD3FF]/20">
          <Alert className="bg-[#0B0F14] border-[#2FD3FF]/50 flex-1">
            <Shield className="h-4 w-4 text-[#2FD3FF]" />
            <AlertDescription className="text-gray-300 text-sm">
              Settings are stored locally in your browser. Keep your passcode secure.
            </AlertDescription>
          </Alert>
          <Button
            onClick={handleSave}
            className="bg-[#2FD3FF] hover:bg-[#2FD3FF]/80 text-black ml-4"
          >
            {saved ? (
              <>
                <CheckCircle className="mr-2" />
                Saved
              </>
            ) : (
              <>
                <Save className="mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
