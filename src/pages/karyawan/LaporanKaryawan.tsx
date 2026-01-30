import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import MobileNavigation from "@/components/MobileNavigation";
import { useIsMobile } from "@/hooks/useIsMobile";

// Reuse logic from RiwayatAbsensi but focused on ONE thing: DOWNLOAD
const LaporanKaryawan = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isMobile = useIsMobile();

    // Redirect to History for now as that's where the logic is
    // But present it as a "Reports Center"

    if (isMobile) {
        return (
            <div className="ios-mobile-container" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>
                {/* iOS Header - Slim */}
                <header className="ios-header-slim">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="ios-back-btn"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="ios-header-title">Laporan Saya</h1>
                            <p className="text-xs text-white/70 mt-0.5">Unduh Data Kehadiran</p>
                        </div>
                    </div>
                </header>

                <div className="px-4 py-6 space-y-4">
                    <div className="ios-card overflow-hidden" onClick={() => navigate("/karyawan/riwayat")}>
                        <div className="ios-card-content flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800">Riwayat & Export</h3>
                                    <p className="text-sm text-slate-500">Lihat dan unduh data absensi</p>
                                </div>
                            </div>
                            <FileDown className="h-5 w-5 text-slate-400" />
                        </div>
                    </div>

                    <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100/50 text-center">
                        <p className="text-sm text-blue-600/80 leading-relaxed mb-4">
                            Seluruh laporan kehadiran dapat diakses dan diunduh melalui menu <span className="font-semibold text-blue-700">Rekap & Riwayat</span>.
                        </p>
                        <button
                            className="ios-btn-primary w-full shadow-lg shadow-blue-500/20"
                            onClick={() => navigate("/karyawan/riwayat")}
                        >
                            Buka Riwayat Absensi
                        </button>
                    </div>
                </div>

                <MobileNavigation />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">Laporan Karyawan</h1>
            <p className="mb-4">Silakan akses menu Riwayat Absensi untuk mengunduh laporan.</p>
            <Button onClick={() => navigate("/karyawan/riwayat")}>Ke Riwayat</Button>
        </div>
    );
};

export default LaporanKaryawan;
