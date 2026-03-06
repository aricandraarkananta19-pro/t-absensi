import { useLocation, Link } from "react-router-dom";
import { Home, History, CalendarDays, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

const navItems: NavItem[] = [
    { icon: Home, label: "Beranda", href: "/dashboard" },
    { icon: CalendarDays, label: "Cuti", href: "/karyawan/cuti" },
    { icon: History, label: "Riwayat", href: "/karyawan/riwayat" },
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
            className="fixed bottom-0 left-0 right-0 z-[40] pb-[env(safe-area-inset-bottom)] pointer-events-none"
            role="navigation"
            aria-label="Mobile navigation"
        >
            <div className="absolute inset-0 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] pointer-events-auto" />

            <div className="relative flex justify-around items-center h-[70px] px-4 max-w-lg mx-auto pointer-events-auto">
                {navItems.map((item, index) => {
                    const active = isActive(item.href);

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => { if (navigator.vibrate) navigator.vibrate(15); }}
                            className="relative flex flex-col items-center justify-center w-[20%] h-full group outline-none active:scale-[0.92] transition-transform duration-300"
                            aria-current={active ? "page" : undefined}
                        >
                            <div className="relative flex flex-col items-center justify-center pt-1">
                                <div className={cn(
                                    "absolute top-0 transition-all duration-300 ease-spring",
                                    active ? "-translate-y-5 opacity-100" : "translate-y-0 opacity-0 scale-50"
                                )}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                                </div>

                                <item.icon
                                    className={cn(
                                        "w-[22px] h-[22px] transition-all duration-300 ease-spring z-10",
                                        active
                                            ? "stroke-[2.5px] text-indigo-600 dark:text-indigo-400 -translate-y-[2px]"
                                            : "stroke-[2px] text-slate-400 dark:text-slate-500"
                                    )}
                                />

                                <span className={cn(
                                    "text-[10px] tracking-wide transition-all duration-300 ease-spring mt-1",
                                    active
                                        ? "font-bold text-indigo-600 dark:text-indigo-400 translate-y-0"
                                        : "font-semibold text-slate-500 dark:text-slate-400 translate-y-0"
                                )}>{item.label}</span>
                            </div>
                        </Link>
                    );
                })}
            </div>
            <style>{`
                .ease-spring {
                    transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
            `}</style>
        </nav>
    );
};

export default MobileNavigation;
