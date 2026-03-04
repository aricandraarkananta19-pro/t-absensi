import { useLocation, Link } from "react-router-dom";
import { Home, History, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

const navItems: NavItem[] = [
    { icon: Home, label: "Beranda", href: "/dashboard" },
    { icon: History, label: "Riwayat", href: "/karyawan/riwayat" },
    { icon: FileText, label: "Jurnal", href: "/karyawan/jurnal" },
    { icon: User, label: "Profil", href: "/karyawan/profil" },
];

const MobileNavigation = () => {
    const location = useLocation();

    const isActive = (href: string) => {
        if (href === "/dashboard") {
            return location.pathname === "/dashboard" || location.pathname === "/";
        }
        return location.pathname === href || location.pathname.startsWith(href);
    };

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]"
            role="navigation"
            aria-label="Mobile navigation"
        >
            {/* Glass background */}
            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/50 dark:border-slate-700/50 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]" />

            <div className="relative flex justify-around items-center h-[66px] px-4 max-w-lg mx-auto">
                {navItems.map((item) => {
                    const active = isActive(item.href);

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => { if (navigator.vibrate) navigator.vibrate(10); }}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95",
                                active ? "text-blue-600" : "text-slate-400"
                            )}
                            aria-current={active ? "page" : undefined}
                        >
                            <div className={cn(
                                "relative p-2 rounded-2xl transition-all duration-300",
                                active ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}>
                                <item.icon
                                    className={cn(
                                        "w-5 h-5 transition-all duration-200",
                                        active
                                            ? "stroke-[2.5px]"
                                            : "stroke-[1.8px] text-slate-400 dark:text-slate-500"
                                    )}
                                />
                                {active && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                                )}
                            </div>
                            <span className={cn(
                                "text-[10px] tracking-tight transition-all duration-200 leading-tight",
                                active ? "font-semibold text-blue-700 dark:text-blue-400" : "font-medium text-slate-500 dark:text-slate-400"
                            )}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileNavigation;
