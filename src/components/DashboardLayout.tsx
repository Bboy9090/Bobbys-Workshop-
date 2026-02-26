/**
 * 🏀 HARE JORDAN'S NYC PLAYGROUND WORKSHOP - Main Dashboard Layout
 * 
 * "Space Jam • Trap House • Legendary"
 * 
 * Super Legendary Trap House Makeover featuring:
 * - Space Jam (1996) color palette - Purple & Orange
 * - Hare Jordan - Bugs Bunny as Michael Jordan
 * - NYC Playground Basketball Courts - Concrete, graffiti, street art
 * - 90s Hip-Hop Culture - Bold, energetic, legendary
 * - Trap House Workshop - Underground lab vibes
 * - Bronx Grit - Street authenticity
 */

import { useState, lazy, Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeviceSidebar } from "./DeviceSidebar";
import { BackendStatusIndicator } from "./BackendStatusIndicator";
import { WorkbenchSystemStatus } from "./workbench/WorkbenchSystemStatus";
import { OrnamentBugsGreeting } from "./ornaments/OrnamentBugsGreeting";
import { useApp } from "@/lib/app-context";
import { useBugsGreeting } from "@/hooks/useBugsGreeting";
import { SpaceJamHeader } from "./space-jam/SpaceJamHeader";
import { SpaceJamNav } from "./space-jam/SpaceJamNav";
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
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBackendHealth } from '@/hooks/use-backend-health';
import { LoadingState } from './LoadingState';

// Screen imports (lazy-loaded to reduce initial bundle size)
const WorkbenchDashboard = lazy(() => import('./screens/WorkbenchDashboard').then(m => ({ default: m.WorkbenchDashboard })));
const WorkbenchDevices = lazy(() => import('./screens/WorkbenchDevices').then(m => ({ default: m.WorkbenchDevices })));
const WorkbenchFlashing = lazy(() => import('./screens/WorkbenchFlashing').then(m => ({ default: m.WorkbenchFlashing })));
const WorkbenchIOS = lazy(() => import('./screens/WorkbenchIOS').then(m => ({ default: m.WorkbenchIOS })));
const WorkbenchSecurity = lazy(() => import('./screens/WorkbenchSecurity').then(m => ({ default: m.WorkbenchSecurity })));
const WorkbenchMonitoring = lazy(() => import('./screens/WorkbenchMonitoring').then(m => ({ default: m.WorkbenchMonitoring })));
const WorkbenchFirmware = lazy(() => import('./screens/WorkbenchFirmware').then(m => ({ default: m.WorkbenchFirmware })));
const WorkbenchWorkflows = lazy(() => import('./screens/WorkbenchWorkflows').then(m => ({ default: m.WorkbenchWorkflows })));
const WorkbenchCases = lazy(() => import('./screens/WorkbenchCases').then(m => ({ default: m.WorkbenchCases })));
const WorkbenchSecretRooms = lazy(() => import('./screens/WorkbenchSecretRooms').then(m => ({ default: m.WorkbenchSecretRooms })));
const WorkbenchSettings = lazy(() => import('./screens/WorkbenchSettings').then(m => ({ default: m.WorkbenchSettings })));
const WorkbenchTranscendent = lazy(() => import('./screens/WorkbenchTranscendent').then(m => ({ default: m.WorkbenchTranscendent })));

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
        { id: 'transcendent', label: 'Transcendent', icon: Sparkles, special: true },
        { id: 'secret-rooms', label: 'The Forge', icon: Flame, special: true },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="h-screen flex flex-col bg-playground bg-trap-basement">
            {/* Header - Space Jam / Hare Jordan Style */}
            <SpaceJamHeader />
            
            {/* Status Bar - Below Header */}
            <div className="h-10 bg-trap-walls border-b-2 border-space-jam flex items-center px-6 gap-4">
                <div className="flex-1" />
                
                {/* Greeting - Only show once per session */}
                {showGreeting && (
                    <div className="px-4 py-1.5 bg-trap-basement border-2 border-neon-cyan rounded-lg glow-cyan">
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
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-spray-neon-yellow">
                            <div className="w-2 h-2 rounded-full bg-spray-neon-yellow animate-pulse glow-cyan" />
                            <span className="uppercase tracking-wider">Initializing...</span>
                        </div>
                    )}
                    {backendHealth.status === 'failed' && (
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-spray-neon-pink">
                            <div className="w-2 h-2 rounded-full bg-spray-neon-pink" />
                            <span className="uppercase tracking-wider">Backend Error</span>
                        </div>
                    )}
                    <div className="h-6 w-px bg-trap-border" />
                    <div className="px-3 py-1 rounded-md bg-trap-basement border border-trap-border text-xs font-mono text-graffiti uppercase tracking-wider">
                        v5.0.0
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Device Sidebar */}
                <DeviceSidebar collapsed={sidebarCollapsed} onToggle={setSidebarCollapsed} />

                {/* Main Content */}
                <main className="flex-1 flex flex-col overflow-hidden min-h-0 bg-playground">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        {/* Navigation Tabs - Space Jam Playground Style */}
                        <div className="border-b-2 border-space-jam bg-trap-walls">
                            <TabsList className="h-14 bg-transparent w-full justify-start rounded-none border-0 px-4 gap-2 overflow-x-auto">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeTab === item.id;
                                    
                                    return (
                                        <TabsTrigger
                                            key={item.id}
                                            value={item.id}
                                            className={cn(
                                                "gap-2 px-5 h-10 rounded-xl transition-all duration-300 font-display font-bold text-sm uppercase tracking-wider relative overflow-hidden",
                                                isActive
                                                    ? item.special 
                                                        ? "btn-space-jam text-legendary shadow-lg glow-purple"
                                                        : "btn-jordan text-legendary shadow-lg glow-jordan"
                                                    : item.special
                                                    ? "bg-trap-basement border-2 border-trap-border text-ink-primary hover:border-neon-cyan hover:text-graffiti hover:glow-cyan"
                                                    : "bg-trap-walls border-2 border-trap-border text-ink-secondary hover:border-space-jam hover:text-legendary hover:bg-space-jam-purple/10"
                                            )}
                                        >
                                            {/* Active Gradient Overlay */}
                                            {isActive && (
                                                <div className="absolute inset-0 bg-gradient-space-jam opacity-20 animate-pulse" />
                                            )}
                                            
                                            <Icon className={cn(
                                                "w-5 h-5 relative z-10",
                                                isActive && "animate-bounce-jordan scale-110"
                                            )} />
                                            <span className="relative z-10">{item.label}</span>
                                            
                                            {/* Hover Glow Effect */}
                                            {!isActive && (
                                                <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-spray-neon-cyan/10 to-transparent" />
                                            )}
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>
                        </div>

                        {/* Content Area - Playground Background */}
                        <ScrollArea className="flex-1 min-h-0 bg-playground">
                            <div className="p-6 min-h-0 bg-playground">
                                <TabsContent value="dashboard" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchDashboard /></Suspense>
                                </TabsContent>
                                <TabsContent value="devices" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchDevices /></Suspense>
                                </TabsContent>
                                <TabsContent value="cases" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchCases /></Suspense>
                                </TabsContent>
                                <TabsContent value="flashing" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchFlashing /></Suspense>
                                </TabsContent>
                                <TabsContent value="ios" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchIOS /></Suspense>
                                </TabsContent>
                                <TabsContent value="security" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchSecurity /></Suspense>
                                </TabsContent>
                                <TabsContent value="monitoring" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchMonitoring /></Suspense>
                                </TabsContent>
                                <TabsContent value="firmware" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchFirmware /></Suspense>
                                </TabsContent>
                                <TabsContent value="workflows" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchWorkflows /></Suspense>
                                </TabsContent>
                                <TabsContent value="transcendent" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchTranscendent /></Suspense>
                                </TabsContent>
                                <TabsContent value="secret-rooms" className="mt-0 p-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchSecretRooms /></Suspense>
                                </TabsContent>
                                <TabsContent value="settings" className="mt-0">
                                    <Suspense fallback={<LoadingState />}><WorkbenchSettings /></Suspense>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </main>
            </div>
        </div>
    );
}
