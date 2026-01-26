/**
 * PHOENIX FORGE - Device Sidebar
 * 
 * Real-time connected device panel with:
 * - Automatic device detection
 * - Status indicators
 * - Quick device selection
 */

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
    CaretLeft, 
    CaretRight, 
    DeviceMobile, 
    CheckCircle, 
    Warning,
    Question,
    Circle,
    Lightning
} from '@phosphor-icons/react';
import { useAndroidDevices } from "@/hooks/use-android-devices";

interface DeviceSidebarProps {
    collapsed: boolean;
    onToggle: (collapsed: boolean) => void;
}

type DeviceStatus = 'connected' | 'weak' | 'confirmed' | 'likely' | 'unconfirmed';

function getStatusColor(status: DeviceStatus) {
    switch (status) {
        case 'connected':
            return 'text-[#10B981]';
        case 'weak':
            return 'text-[#F59E0B]';
        case 'confirmed':
            return 'text-[#FF4D00]';
        case 'likely':
            return 'text-[#7C3AED]';
        case 'unconfirmed':
            return 'text-[#64748B]';
        default:
            return 'text-[#64748B]';
    }
}

function getStatusIcon(status: DeviceStatus) {
    const baseClass = "w-4 h-4";
    switch (status) {
        case 'connected':
            return <CheckCircle weight="fill" className={`${baseClass} text-[#10B981]`} />;
        case 'weak':
            return <Warning weight="fill" className={`${baseClass} text-[#F59E0B]`} />;
        case 'confirmed':
            return <Lightning weight="fill" className={`${baseClass} text-[#FF4D00]`} />;
        case 'likely':
            return <Circle weight="fill" className={`${baseClass} text-[#7C3AED]`} />;
        case 'unconfirmed':
            return <Question weight="fill" className={`${baseClass} text-[#64748B]`} />;
        default:
            return <Circle weight="fill" className={`${baseClass} text-[#64748B]`} />;
    }
}

export function DeviceSidebar({ collapsed, onToggle }: DeviceSidebarProps) {
    const { devices } = useAndroidDevices();

    return (
        <aside 
            className={`border-r border-white/[0.08] bg-[#0F0F1A] transition-all duration-300 ${
                collapsed ? 'w-14' : 'w-64'
            }`}
        >
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="h-12 border-b border-white/[0.08] flex items-center justify-between px-3">
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <DeviceMobile className="w-4 h-4 text-[#FF6B2C]" />
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                                Devices
                            </h2>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 text-[#64748B] hover:text-[#F1F5F9]"
                        onClick={() => onToggle(!collapsed)}
                    >
                        {collapsed ? <CaretRight className="w-4 h-4" /> : <CaretLeft className="w-4 h-4" />}
                    </Button>
                </div>

                {/* Device List */}
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {devices.length === 0 && (
                            <div className={`${collapsed ? 'p-2' : 'p-4'} text-center`}>
                                <div className="text-[#64748B] text-xs">
                                    {collapsed ? (
                                        <DeviceMobile className="w-5 h-5 mx-auto opacity-30" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-10 h-10 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                                                <DeviceMobile className="w-5 h-5 text-[#64748B]" />
                                            </div>
                                            <p className="text-[#64748B] text-xs">No devices connected</p>
                                            <p className="text-[#475569] text-[10px]">Connect a device via USB</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {devices.map((device) => (
                            <button
                                key={device.serial}
                                className="w-full text-left rounded-lg hover:bg-white/[0.03] transition-all duration-200 p-2 border border-transparent hover:border-white/[0.05] group"
                            >
                                <div className="flex items-start gap-2">
                                    <div className="mt-0.5">
                                        {getStatusIcon(device.state as DeviceStatus)}
                                    </div>
                                    {!collapsed && (
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-[#F1F5F9] truncate group-hover:text-[#FF6B2C] transition-colors">
                                                    {device.model || 'Unknown Device'}
                                                </p>
                                                {device.source && (
                                                    <Badge 
                                                        variant="ghost" 
                                                        size="sm"
                                                    >
                                                        {device.source}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-mono text-[#64748B] truncate mt-0.5">
                                                {device.serial}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="border-t border-white/[0.08] p-2 bg-white/[0.01]">
                    {collapsed ? (
                        <div className="flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-[#FF4D00]/10 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-[#FF6B2C]">{devices.length}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between px-2">
                            <span className="text-xs text-[#64748B]">
                                {devices.length} {devices.length === 1 ? 'device' : 'devices'}
                            </span>
                            {devices.length > 0 && (
                                <Badge variant="online" size="sm">
                                    Live
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
