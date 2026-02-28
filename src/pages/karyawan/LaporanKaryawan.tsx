import { useNavigate } from "react-router-dom";
import { FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";
import KaryawanWorkspaceLayout from "@/components/layout/KaryawanWorkspaceLayout";

const LaporanKaryawan = () => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    // Mobile view
    if (isMobile) {
        return (
            <div className="min-h-screen bg-slate-50/50 pb-20 font-['Inter',sans-serif] relative overflow-x-hidden text-slate-900">
                <div className="absolute top-0 right-0 -z-0 w-[60vw] h-[40vh] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none opacity-60 transform translate-x-1/2 -translate-y-1/2"></div>

                <header className="w-full px-6 py-6 relative z-10">
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Pusat Laporan</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Unduh rekaman data kehadiran Anda.</p>
                </header>

                <main className="w-full px-6 py-4 relative z-10">
                    <div className="bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-xl shadow-slate-200/40 p-6 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="h-20 w-20 rounded-[28px] bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                            <FileText className="h-10 w-10" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Riwayat & Export</h2>
                            <p className="text-slate-500 font-medium text-sm mt-2 max-w-sm mx-auto">
                                Seluruh laporan kehadiran dapat diakses secara real-time dan diunduh melalui menu Riwayat Absensi.
                            </p>
                        </div>
                        <Button
                            size="lg"
                            className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all text-sm w-full mt-4"
                            onClick={() => navigate("/karyawan/riwayat")}
                        >
                            <FileDown className="w-5 h-5 mr-2" />
                            Buka Riwayat Absensi
                        </Button>
                    </div>
                </main>

                <MobileNavigation />
            </div>
        );
    }

    // Desktop view with KaryawanWorkspaceLayout
    return (
        <KaryawanWorkspaceLayout>
            <div className="mb-6 pb-4 border-b border-slate-200/50">
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Pusat Laporan</h1>
                <p className="text-slate-500 font-medium text-sm mt-1">Unduh rekaman data kehadiran Anda.</p>
            </div>
            <div className="max-w-2xl mx-auto py-12">
                <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="h-20 w-20 rounded-[28px] bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50">
                        <FileText className="h-10 w-10" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Riwayat & Export</h2>
                        <p className="text-slate-500 font-medium text-sm mt-2 max-w-sm mx-auto">
                            Seluruh laporan kehadiran dapat diakses secara real-time dan diunduh secara penuh melalui menu Riwayat Absensi.
                        </p>
                    </div>
                    <Button
                        size="lg"
                        className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg active:scale-95 transition-all text-sm mt-4"
                        onClick={() => navigate("/karyawan/riwayat")}
                    >
                        <FileDown className="w-5 h-5 mr-2" />
                        Buka Riwayat Absensi
                    </Button>
                </div>
            </div>
        </KaryawanWorkspaceLayout>
    );
};

export default LaporanKaryawan;
