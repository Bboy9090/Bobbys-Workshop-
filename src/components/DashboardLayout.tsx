/**
 * PHOENIX FORGE - Main Dashboard Layout
 * 
 * "Rise from the Ashes. Every Device Reborn."
 * 
 * Legendary device repair platform featuring:
 * - Modern glassmorphism UI
 * - Phoenix fire/gold/violet aesthetic
 * - Professional yet powerful design
 */

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeviceSidebar } from "./DeviceSidebar";
import { BackendStatusIndicator } from "./BackendStatusIndicator";
import { WorkbenchSystemStatus } from "./workbench/WorkbenchSystemStatus";
import { OrnamentBugsGreeting } from "./ornaments/OrnamentBugsGreeting";
import { useApp } from "@/lib/app-context";
import { useBugsGreeting } from "@/hooks/useBugsGreeting";
import { 
    LayoutDashboard,
    Smartphone,
    Zap,
    Apple,
    Shield,
    Activity,
    Package,
    Workflow,
    Lock,
    Settings,
    FileText,
    Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Screen imports
import { WorkbenchDashboard } from './screens/WorkbenchDashboard';
import { WorkbenchDevices } from './screens/WorkbenchDevices';
import { WorkbenchFlashing } from './screens/WorkbenchFlashing';
import { WorkbenchIOS } from './screens/WorkbenchIOS';
import { WorkbenchSecurity } from './screens/WorkbenchSecurity';
import { WorkbenchMonitoring } from './screens/WorkbenchMonitoring';
import { WorkbenchFirmware } from './screens/WorkbenchFirmware';
import { WorkbenchWorkflows } from './screens/WorkbenchWorkflows';
import { WorkbenchCases } from './screens/WorkbenchCases';
import { useBackendHealth } from '@/hooks/use-backend-health';
import { WorkbenchSecretRooms } from './screens/WorkbenchSecretRooms';
import { WorkbenchSettings } from './screens/WorkbenchSettings';

export function DashboardLayout() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { backendAvailable } = useApp();
    const { showGreeting, dismiss } = useBugsGreeting({ enabled: true });
    const backendHealth = useBackendHealth();

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'devices', label: 'Devices', icon: Smartphone },
        { id: 'cases', label: 'Cases', icon: FileText },
        { id: 'flashing', label: 'Flash Forge', icon: Zap },
        { id: 'ios', label: 'iOS', icon: Apple },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'monitoring', label: 'Monitoring', icon: Activity },
        { id: 'firmware', label: 'Firmware', icon: Package },
        { id: 'workflows', label: 'Workflows', icon: Workflow },
        { id: 'secret-rooms', label: 'The Forge', icon: Flame, special: true },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="h-screen flex flex-col bg-forge-deep">
            {/* Header - Phoenix Forge Style */}
            <header className="h-16 border-b border-white/10 bg-forge-surface/80 backdrop-blur-xl flex items-center px-6 gap-4">
                <div className="flex items-center gap-4">
                    {/* Phoenix Logo */}
                    <div className="relative">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-phoenix-fire-core via-phoenix-gold-core to-phoenix-fire-bright flex items-center justify-center shadow-lg glow-fire">
                            <Flame className="w-6 h-6 text-white drop-shadow-lg" />
                        </div>
                        {/* Ember particles */}
                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-phoenix-gold-core animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">
                            <span className="text-fire">PHOENIX FORGE</span>
                        </h1>
                        <p className="text-xs text-phoenix-ink-muted font-medium tracking-wide">
                            Rise from the Ashes. Every Device Reborn.
                        </p>
                    </div>
                </div>
                
                <div className="flex-1" />
                
                {/* Greeting - Only show once per session */}
                {showGreeting && (
                    <div className="px-4 py-2 bg-forge-glass backdrop-blur-md border border-white/10 rounded-lg">
                        <OrnamentBugsGreeting 
                            variant={backendAvailable ? 'devices' : 'warning'}
                            onDismiss={dismiss}
                            autoHide={true}
                            autoHideDuration={4000}
                        />
                    </div>
                )}
                
                <div className="flex items-center gap-4">
                    <BackendStatusIndicator />
                    {backendHealth.status === 'booting' && (
                        <div className="flex items-center gap-2 text-xs font-medium text-phoenix-ink-muted">
                            <div className="w-2 h-2 rounded-full bg-phoenix-warning-core animate-pulse" />
                            <span>Initializing...</span>
                        </div>
                    )}
                    {backendHealth.status === 'failed' && (
                        <div className="flex items-center gap-2 text-xs font-medium text-phoenix-danger-core">
                            <div className="w-2 h-2 rounded-full bg-phoenix-danger-core" />
                            <span>Backend Error</span>
                        </div>
                    )}
                    <div className="h-6 w-px bg-white/10" />
                    <div className="px-2 py-1 rounded-md bg-forge-elevated text-xs font-mono text-phoenix-ink-secondary">
                        v5.0.0
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Device Sidebar */}
                <DeviceSidebar collapsed={sidebarCollapsed} onToggle={setSidebarCollapsed} />

                {/* Main Content */}
                <main className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        {/* Navigation Tabs - Phoenix Style */}
                        <div className="border-b border-white/10 bg-forge-surface/50 backdrop-blur-sm">
                            <TabsList className="h-12 bg-transparent w-full justify-start rounded-none border-0 px-4 gap-1 overflow-x-auto">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeTab === item.id;
                                    
                                    return (
                                        <TabsTrigger
                                            key={item.id}
                                            value={item.id}
                                            className={cn(
                                                "gap-2 px-4 h-9 rounded-lg transition-all duration-200 font-medium text-sm",
                                                isActive
                                                    ? item.special 
                                                        ? "bg-gradient-to-r from-phoenix-fire-core to-phoenix-gold-core text-white shadow-lg glow-fire"
                                                        : "bg-phoenix-fire-core/20 text-phoenix-fire-bright border border-phoenix-fire-core/30"
                                                    : item.special
                                                    ? "bg-forge-elevated/50 border border-phoenix-fire-core/20 text-phoenix-fire-glow hover:bg-phoenix-fire-core/10 hover:border-phoenix-fire-core/40"
                                                    : "bg-transparent text-phoenix-ink-secondary hover:text-phoenix-ink-primary hover:bg-white/5"
                                            )}
                                        >
                                            <Icon className={cn(
                                                "w-4 h-4",
                                                isActive && item.special && "animate-pulse"
                                            )} />
                                            <span>{item.label}</span>
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>
                        </div>

                        {/* Content Area */}
                        <ScrollArea className="flex-1 min-h-0 bg-forge-deep">
                            <div className="p-6 min-h-0">
                                <TabsContent value="dashboard" className="mt-0">
                                    <WorkbenchDashboard />
                                </TabsContent>
                                <TabsContent value="devices" className="mt-0">
                                    <WorkbenchDevices />
                                </TabsContent>
                                <TabsContent value="cases" className="mt-0">
                                    <WorkbenchCases />
                                </TabsContent>
                                <TabsContent value="flashing" className="mt-0">
                                    <WorkbenchFlashing />
                                </TabsContent>
                                <TabsContent value="ios" className="mt-0">
                                    <WorkbenchIOS />
                                </TabsContent>
                                <TabsContent value="security" className="mt-0">
                                    <WorkbenchSecurity />
                                </TabsContent>
                                <TabsContent value="monitoring" className="mt-0">
                                    <WorkbenchMonitoring />
                                </TabsContent>
                                <TabsContent value="firmware" className="mt-0">
                                    <WorkbenchFirmware />
                                </TabsContent>
                                <TabsContent value="workflows" className="mt-0">
                                    <WorkbenchWorkflows />
                                </TabsContent>
                                <TabsContent value="secret-rooms" className="mt-0 p-0">
                                    <WorkbenchSecretRooms />
                                </TabsContent>
                                <TabsContent value="settings" className="mt-0">
                                    <WorkbenchSettings />
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </main>
            </div>
        </div>
    );
}
