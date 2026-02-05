import { useEffect, useState, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X, Wifi, WifiOff } from "lucide-react";

const PWAUpdatePrompt = () => {
    const [offlineReady, setOfflineReady] = useState(false);
    const [needRefresh, setNeedRefresh] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // CRITICAL FIX: Store interval ID for proper cleanup
    const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const {
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            console.log("SW registered:", swUrl);
            // Check for updates every 1 hour - WITH CLEANUP
            if (registration) {
                // Clear any existing interval first
                if (updateIntervalRef.current) {
                    clearInterval(updateIntervalRef.current);
                }
                updateIntervalRef.current = setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error("SW registration error:", error);
        },
        onOfflineReady() {
            setOfflineReady(true);
            // Auto-hide after 3 seconds
            setTimeout(() => setOfflineReady(false), 3000);
        },
        onNeedRefresh() {
            setNeedRefresh(true);
        },
    });

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
                updateIntervalRef.current = null;
            }
        };
    }, []);

    // Track online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    const handleUpdate = () => {
        updateServiceWorker(true);
    };

    // Offline indicator
    if (!isOnline) {
        return (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-down">
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full shadow-lg">
                    <WifiOff className="h-4 w-4" />
                    <span className="text-sm font-medium">Anda sedang offline</span>
                </div>
            </div>
        );
    }

    // Offline ready notification
    if (offlineReady) {
        return (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] animate-slide-up max-w-[320px]">
                <div className="flex items-center gap-3 px-4 py-3 bg-green-600 text-white rounded-xl shadow-lg">
                    <Wifi className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm">Aplikasi siap digunakan secara offline!</p>
                    <button onClick={close} className="p-1 hover:bg-white/20 rounded-full">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Update available notification
    if (needRefresh) {
        return (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] animate-slide-up w-[calc(100%-2rem)] max-w-[360px]">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <RefreshCw className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">Update Tersedia</h4>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Versi baru T-Absensi telah tersedia. Refresh untuk memperbarui.
                                </p>
                            </div>
                            <button onClick={close} className="p-1 hover:bg-gray-100 rounded-full -mt-1 -mr-1">
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={close}
                                className="flex-1"
                            >
                                Nanti
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleUpdate}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                <RefreshCw className="h-4 w-4 mr-1.5" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default PWAUpdatePrompt;
