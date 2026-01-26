import { useState, useEffect } from 'react';
import { DashboardLayout } from "./components/DashboardLayout";
import { LoadingPage } from "./components/core/LoadingPage";
import { SplashPage } from "./components/core/SplashPage";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider, useApp } from "./lib/app-context";
import { GlobalDeviceProvider } from "./lib/global-device-state";
import { checkBackendHealth } from "./lib/backend-health";
import { soundManager } from "./lib/soundManager";
import { setupGlobalErrorHandler } from "./lib/error-handler";
import { initOfflineStorage, networkStatus } from "./lib/offline-storage";
import { initializeWebSockets, cleanupWebSockets } from "./lib/websocket-hub";
import { createLogger } from "./lib/debug-logger";

const logger = createLogger('App');

function AppContent() {
    const { setBackendAvailable } = useApp();
    const [isLoading, setIsLoading] = useState(true);
    const [showSplash, setShowSplash] = useState(true);
    const [initError, setInitError] = useState<Error | null>(null);
    const [backendConnected, setBackendConnected] = useState(false);

    useEffect(() => {
        async function initializeApp() {
            try {
                setIsLoading(true);
                setInitError(null);
                logger.info('Initializing Phoenix Forge...');
                
                // Setup global error handler
                setupGlobalErrorHandler();
                logger.debug('Error handler initialized');
                
                // Initialize offline storage
                await initOfflineStorage();
                logger.debug('Offline storage ready');
                
                // Brief initialization delay
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const backendHealthy = await checkBackendHealth();
                setBackendAvailable(backendHealthy.isHealthy);
                setBackendConnected(backendHealthy.isHealthy);

                if (!backendHealthy.isHealthy) {
                    logger.warn('Backend not available - please start the backend server');
                } else {
                    logger.info('Backend connected - production mode active');
                    // Initialize WebSocket connections
                    initializeWebSockets();
                    logger.debug('WebSocket connections initialized');
                }
                
                // Listen for network status changes
                networkStatus.subscribe((online) => {
                    if (online) {
                        // Re-check backend when coming online
                        checkBackendHealth().then(result => {
                            if (result.isHealthy) {
                                setBackendAvailable(true);
                                setBackendConnected(true);
                                initializeWebSockets();
                            }
                        });
                    }
                });
                
                setIsLoading(false);
                logger.info('Initialization complete - Forge ready!');
            } catch (error) {
                logger.error('Initialization error:', error);
                setInitError(error instanceof Error ? error : new Error(String(error)));
                setIsLoading(false);
            }
        }

        initializeApp();

        return () => {
            cleanupWebSockets();
        };
    }, [setBackendAvailable]);

    useEffect(() => {
        soundManager.init();
        return () => soundManager.destroy();
    }, []);

    const handleRetryConnection = async () => {
        const backendHealthy = await checkBackendHealth();
        if (backendHealthy.isHealthy) {
            setBackendAvailable(true);
            setBackendConnected(true);
            initializeWebSockets();
        }
    };

    // Show error if initialization failed
    if (initError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0A0A12' }}>
                <div className="max-w-md w-full bg-[#14142B] border border-white/10 rounded-xl p-6 shadow-xl">
                    <h1 className="text-xl font-bold text-[#F1F5F9] mb-2">Initialization Error</h1>
                    <p className="text-sm text-[#64748B] mb-4">Failed to initialize Phoenix Forge.</p>
                    <pre className="text-xs text-[#FB7185] bg-[#0A0A12] p-3 rounded-lg border border-white/5 overflow-auto max-h-32 font-mono">
                        {initError.message}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-gradient-to-r from-[#FF4D00] to-[#FF6B2C] text-white rounded-lg hover:shadow-lg hover:shadow-[rgba(255,77,0,0.3)] transition-all"
                    >
                        Restart Forge
                    </button>
                </div>
            </div>
        );
    }

    // Show loading page during initialization
    if (isLoading) {
        return <LoadingPage />;
    }

    // Show splash page (auto-dismisses)
    if (showSplash) {
        return <SplashPage onComplete={() => setShowSplash(false)} />;
    }

    // Show backend connection warning if not connected (non-blocking)
    return (
        <>
            {!backendConnected && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-[#1A1A38]/95 backdrop-blur-md border-b border-[#F59E0B]/30 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                        <span className="text-[#FCD34D] text-sm font-medium">
                            Backend forge not connected. Some features may be unavailable.
                        </span>
                    </div>
                    <button
                        onClick={handleRetryConnection}
                        className="px-3 py-1.5 bg-[#F59E0B] text-[#0A0A12] text-xs font-semibold rounded-lg hover:bg-[#FCD34D] transition-colors"
                    >
                        Reconnect
                    </button>
                </div>
            )}
            <DashboardLayout />
            <Toaster />
        </>
    );
}

function App() {
    return (
        <AppProvider>
            <GlobalDeviceProvider>
                <AppContent />
            </GlobalDeviceProvider>
        </AppProvider>
    );
}

export default App