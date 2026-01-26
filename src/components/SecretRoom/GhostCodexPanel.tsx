/**
 * Ghost Codex Panel - Secret Room #9
 * Metadata shredding, canary tokens, burner personas
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { FileX, Shield, User, AlertTriangle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

export const GhostCodexPanel: React.FC = () => {
  const [personas, setPersonas] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPersonas();
    loadAlerts();
    const interval = setInterval(() => {
      loadPersonas();
      loadAlerts();
    }, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPersonas = async () => {
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/ghost/personas', {
        headers: {
          'X-Secret-Room-Passcode': passcode
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.personas) {
          setPersonas(data.data.personas);
        }
      }
    } catch (error) {
      console.error('Failed to load personas:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/ghost/alerts', {
        headers: {
          'X-Secret-Room-Passcode': passcode
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.alerts) {
          setAlerts(data.data.alerts);
        }
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const handleGenerateCanary = async () => {
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/ghost/canary/generate', {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tokenType: 'file' })
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Canary token generated: ${data.data?.tokenId || data.tokenId}`);
      }
    } catch (error) {
      console.error('Failed to generate canary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePersona = async () => {
    setIsLoading(true);
    try {
      const passcode = localStorage.getItem('trapdoor-passcode') || localStorage.getItem('bobbysWorkshop.secretRoomPasscode') || '';
      const response = await fetch('/api/v1/trapdoor/ghost/persona/create', {
        method: 'POST',
        headers: {
          'X-Secret-Room-Passcode': passcode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ personaType: 'basic' })
      });
      if (response.ok) {
        loadPersonas(); // Refresh list
      }
    } catch (error) {
      console.error('Failed to create persona:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-[#141922] border-[#FF6B9D]/50">
        <Shield className="h-4 w-4 text-[#FF6B9D]" />
        <AlertDescription className="text-gray-300">
          <strong className="text-[#FF6B9D]">Ghost Codex</strong> - Metadata shredding, canary tokens, burner personas.
          Proxies to FastAPI backend.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="shred" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-[#141922]">
          <TabsTrigger value="shred">Shred</TabsTrigger>
          <TabsTrigger value="canary">Canary</TabsTrigger>
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="shred" className="space-y-4">
          <Card className="bg-[#141922] border-[#FF6B9D]/20">
            <CardHeader>
              <CardTitle className="text-white">Metadata Shredder</CardTitle>
              <CardDescription className="text-gray-400">
                Remove metadata from files (EXIF, document metadata, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">File upload interface coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="canary" className="space-y-4">
          <Card className="bg-[#141922] border-[#FF6B9D]/20">
            <CardHeader>
              <CardTitle className="text-white">Canary Tokens</CardTitle>
              <CardDescription className="text-gray-400">
                Generate canary tokens for intrusion detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
              onClick={handleGenerateCanary}
              disabled={isLoading}
              className="bg-[#FF6B9D] hover:bg-[#FF6B9D]/80 text-white"
            >
              {isLoading ? 'Generating...' : 'Generate Token'}
            </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="persona" className="space-y-4">
          <Card className="bg-[#141922] border-[#FF6B9D]/20">
            <CardHeader>
              <CardTitle className="text-white">Burner Personas</CardTitle>
              <CardDescription className="text-gray-400">
                Create and manage burner personas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
              onClick={handleCreatePersona}
              disabled={isLoading}
              className="bg-[#FF6B9D] hover:bg-[#FF6B9D]/80 text-white mb-4"
            >
              <User className="mr-2" />
              {isLoading ? 'Creating...' : 'Create Persona'}
            </Button>
              {personas.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No personas created</p>
              ) : (
                <div className="space-y-2">
                  {personas.map((persona) => (
                    <div key={persona.id} className="p-3 bg-[#0B0F14] rounded">
                      <p className="text-white">{persona.name}</p>
                      <p className="text-sm text-gray-400">{persona.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card className="bg-[#141922] border-[#FF6B9D]/20">
            <CardHeader>
              <CardTitle className="text-white">Canary Alerts</CardTitle>
              <CardDescription className="text-gray-400">
                View triggered canary token alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No alerts</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-3 bg-[#0B0F14] rounded border-l-4 border-[#FF6B9D]">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="text-[#FF6B9D]" />
                        <p className="text-white">{alert.message}</p>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{alert.timestamp}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
