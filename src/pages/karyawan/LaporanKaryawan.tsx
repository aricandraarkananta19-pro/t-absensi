import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";

const LaporanKaryawan = () => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20 font-['Inter',sans-serif] relative overflow-x-hidden text-slate-900">
            {/* Background Graphic Abstract */}
            <div className="absolute top-0 right-0 -z-0 w-[60vw] h-[40vh] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none opacity-60 transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 -z-0 w-[40vw] h-[40vh] bg-emerald-100/30 rounded-full blur-[100px] pointer-events-none opacity-60 transform -translate-x-1/2 translate-y-1/2"></div>

            {/* Header */}
            <header className="px-6 py-6 md:py-8 max-w-3xl mx-auto relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/dashboard")}
                        className="mb-6 text-slate-500 hover:text-slate-800 hover:bg-white/50 border border-transparent hover:border-slate-200/60 rounded-xl transition-all shadow-sm bg-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali ke Dashboard
                    </Button>
                    <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-800 tracking-tight">Pusat Laporan</h1>
                    <p className="text-slate-500 font-medium text-sm mt-2 max-w-md">Unduh seluruh rekaman data kehadiran Anda dalam format PDF atau Excel.</p>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-3xl mx-auto px-6 py-4 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-xl shadow-slate-200/40 p-6 md:p-8 flex flex-col items-center justify-center text-center space-y-6">
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
                        className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all text-sm md:text-base w-full sm:w-auto mt-4"
                        onClick={() => navigate("/karyawan/riwayat")}
                    >
                        <FileDown className="w-5 h-5 mr-2" />
                        Buka Riwayat Absensi
                    </Button>
                </div>
            </main>

            {isMobile && <MobileNavigation />}
        </div>
    );
};

export default LaporanKaryawan;
