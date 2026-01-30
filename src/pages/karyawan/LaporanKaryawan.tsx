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
            <div className="ios-mobile-container">
                {/* iOS Header */}
                <header className="ios-header" style={{ paddingBottom: "24px" }}>
                    <div className="relative z-10 flex items-center gap-3">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="p-2 -ml-2 rounded-full bg-white/10 active:bg-white/20 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5 text-white" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-white">Laporan Saya</h1>
                            <p className="text-sm text-white/70">Unduh Data Kehadiran</p>
                        </div>
                    </div>
                </header>

                <div className="px-4 py-6 space-y-4">
                    <Card className="border-0 shadow-sm bg-white overflow-hidden" onClick={() => navigate("/karyawan/riwayat")}>
                        <CardContent className="p-0">
                            <div className="p-5 flex items-center justify-between active:bg-slate-50 transition-colors cursor-pointer">
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
                        </CardContent>
                    </Card>

                    <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
                        <p className="text-sm text-blue-600/80 leading-relaxed text-center">
                            Untuk saat ini, seluruh laporan kehadiran dapat diakses dan diunduh melalui menu <span className="font-semibold text-blue-700">Rekap / Riwayat</span>.
                        </p>
                        <Button
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                            onClick={() => navigate("/karyawan/riwayat")}
                        >
                            Buka Riwayat Absensi
                        </Button>
                    </div>
                </div>

                <MobileNavigation />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <h1>Laporan Karyawan</h1>
            <p>Silakan akses menu Riwayat Absensi untuk mengunduh laporan.</p>
            <Button onClick={() => navigate("/karyawan/riwayat")}>Ke Riwayat</Button>
        </div>
    );
};

export default LaporanKaryawan;
