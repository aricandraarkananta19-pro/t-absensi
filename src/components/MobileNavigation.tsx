import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Clock, History, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Clock, label: "Absen", href: "/karyawan/absensi" },
    { icon: History, label: "Rekap", href: "/karyawan/riwayat" },
    { icon: FileText, label: "Laporan", href: "/karyawan/laporan" },
    { icon: Settings, label: "Setting", href: "/karyawan/profil" },
];

/**
 * Mobile Bottom Navigation for Employee UI (Premium iOS Style)
 * - Fixed height + safe-area padding for iOS
 * - 5 Items as requested
 * - Premium Glassmorphism look
 */
const MobileNavigation = () => {
    const location = useLocation();

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.03)]"
            role="navigation"
            aria-label="Mobile navigation"
        >
            <div className="flex items-center justify-around h-[64px] px-2 bg-gradient-to-t from-white/50 to-transparent">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href ||
                        (item.href === "/dashboard" && location.pathname === "/");

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-95 touch-manipulation group",
                                isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                            )}
                            aria-current={isActive ? "page" : undefined}
                        >
                            <div className={cn(
                                "relative p-1.5 rounded-2xl transition-all duration-300",
                                isActive && "bg-blue-50/80 shadow-sm"
                            )}>
                                <item.icon
                                    className={cn(
                                        "w-5 h-5 transition-transform duration-300",
                                        isActive ? "stroke-[2.5px] scale-105" : "stroke-2 group-hover:scale-105"
                                    )}
                                />
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium tracking-tight transition-colors duration-200",
                                isActive ? "text-blue-700 font-semibold" : "text-slate-500"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileNavigation;
