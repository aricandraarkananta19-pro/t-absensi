import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search, Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    setMounted(true);
  }, [location.pathname]);

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 px-6 relative overflow-hidden">
      {/* Decorative blurred shapes */}
      <div className="absolute top-[-120px] right-[-80px] w-[400px] h-[400px] rounded-full bg-indigo-200/30 dark:bg-indigo-800/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-80px] left-[-60px] w-[320px] h-[320px] rounded-full bg-violet-200/30 dark:bg-violet-800/10 blur-[80px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-100/20 dark:bg-blue-900/5 blur-[120px] pointer-events-none" />

      <div className={`relative z-10 text-center max-w-lg transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Animated 404 Number */}
        <div className="relative mb-6">
          <h1 className="text-[140px] sm:text-[180px] font-black leading-none tracking-tighter bg-gradient-to-br from-indigo-600 via-violet-500 to-purple-600 bg-clip-text text-transparent select-none animate-pulse" style={{ animationDuration: '3s' }}>
            404
          </h1>
          {/* Floating compass icon */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-16 h-16 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/50 dark:border-slate-700 shadow-xl flex items-center justify-center animate-bounce" style={{ animationDuration: '2s' }}>
              <Compass className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-3">
          Halaman Tidak Ditemukan
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base max-w-sm mx-auto mb-2 font-medium leading-relaxed">
          Sepertinya halaman yang Anda cari sudah dipindahkan, dihapus, atau belum pernah ada.
        </p>

        {/* Requested path */}
        <div className="inline-flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/60 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 mb-8">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <code className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
            {location.pathname}
          </code>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handleGoBack}
            variant="outline"
            className="rounded-2xl h-12 px-6 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold shadow-sm gap-2 transition-all duration-200 hover:-translate-y-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="rounded-2xl h-12 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-lg shadow-indigo-500/25 gap-2 transition-all duration-200 hover:-translate-y-0.5"
          >
            <Home className="w-4 h-4" />
            Ke Dashboard
          </Button>
        </div>

        {/* Footer hint */}
        <p className="text-xs text-slate-400 mt-10 font-medium">
          Talenta Digital Absensi • Enterprise HRIS Platform
        </p>
      </div>
    </div>
  );
};

export default NotFound;
