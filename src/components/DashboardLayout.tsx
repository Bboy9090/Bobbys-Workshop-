import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DiagnosticsTab } from "./tabs/DiagnosticsTab";
import { ReportsTab } from "./tabs/ReportsTab";
import { TestsTab } from "./tabs/TestsTab";
import { PluginsTab } from "./tabs/PluginsTab";
import { CommunityTab } from "./tabs/CommunityTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { PandorasRoom } from "./SecretRoom";
import { LiveAnalyticsDashboard } from "./LiveAnalyticsDashboard";
import { DeviceSidebar } from "./DeviceSidebar";
import { LogsPanel } from "./LogsPanel";
import { useApp } from "@/lib/app-context";
import { 
    Cpu, 
    FileText, 
    Flask, 
    Plug, 
    Users, 
    Gear,
    Wrench,
    LockKey,
    ChartLine
} from '@phosphor-icons/react';

export function DashboardLayout() {
    const [activeTab, setActiveTab] = useState('diagnostics');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { backendAvailable } = useApp();

    return (
        <div className="h-screen flex flex-col bg-background">
            <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
                        <Wrench className="text-primary-foreground" size={16} weight="bold" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h1 className="font-display text-xl text-foreground tracking-tight">
                            BOBBY'S WORLD
                        </h1>
                        <span className="text-xs text-muted-foreground font-mono">Workshop Toolkit</span>
                    </div>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                    <Badge variant={backendAvailable ? "default" : "destructive"} className="text-xs font-mono">
                        {backendAvailable ? "API Connected" : "Offline Mode"}
                    </Badge>
                    <div className="text-xs font-mono text-muted-foreground">
                        v2.0.0
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <DeviceSidebar collapsed={sidebarCollapsed} onToggle={setSidebarCollapsed} />

                <main className="flex-1 flex flex-col overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                        <div className="border-b border-border bg-card/30">
                            <TabsList className="h-11 bg-transparent w-full justify-start rounded-none border-0 px-3 gap-1">
                                <TabsTrigger 
                                    value="diagnostics" 
                                    className="gap-1.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    <Cpu weight="duotone" size={18} />
                                    <span className="font-medium">Diagnostics</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="analytics" 
                                    className="gap-1.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    <ChartLine weight="duotone" size={18} />
                                    <span className="font-medium">Live Analytics</span>
                                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">NEW</Badge>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="pandoras-room" 
                                    className="gap-1.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    <LockKey weight="duotone" size={18} />
                                    <span className="font-medium">Pandora's Room</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="reports" 
                                    className="gap-1.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    <FileText weight="duotone" size={18} />
                                    <span className="font-medium">Reports</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="tests" 
                                    className="gap-1.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    <Flask weight="duotone" size={18} />
                                    <span className="font-medium">Tests</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="plugins" 
                                    className="gap-1.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    <Plug weight="duotone" size={18} />
                                    <span className="font-medium">Plugins</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="community" 
                                    className="gap-1.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    <Users weight="duotone" size={18} />
                                    <span className="font-medium">Community</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="settings" 
                                    className="gap-1.5 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    <Gear weight="duotone" size={18} />
                                    <span className="font-medium">Settings</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-4">
                                <TabsContent value="diagnostics" className="mt-0">
                                    <DiagnosticsTab />
                                </TabsContent>
                                <TabsContent value="pandoras-room" className="mt-0 p-0">
                                    <PandorasRoom />
                                </TabsContent>
                                <TabsContent value="reports" className="mt-0">
                                    <ReportsTab />
                                </TabsContent>
                                <TabsContent value="tests" className="mt-0">
                                    <TestsTab />
                                </TabsContent>
                                <TabsContent value="plugins" className="mt-0">
                                    <PluginsTab />
                                </TabsContent>
                                <TabsContent value="community" className="mt-0">
                                    <CommunityTab />
                                </TabsContent>
                                <TabsContent value="settings" className="mt-0">
                                    <SettingsTab />
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>

                    <LogsPanel />
                </main>
            </div>
        </div>
    );
}
