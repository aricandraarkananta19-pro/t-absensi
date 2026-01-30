import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

/**
 * iOS-Style Bottom Navigation (68px height + safe area)
 * 4 Items: Dashboard, Employees, Reports, Menu
 * - Fixed at bottom with safe area padding
 * - Icon + Label for each item
 * - Clear active state with brand color
 * - Minimum 44px tap target
 * - Doesn't overlap with content
 */
const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Users, label: "Karyawan", href: "/karyawan/absensi" },
    { icon: FileText, label: "Laporan", href: "/karyawan/riwayat" },
    { icon: Menu, label: "Menu", href: "/karyawan/profil" },
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
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 pb-[env(safe-area-inset-bottom)] flex justify-between px-6 items-center shadow-[0_-4px_10px_rgba(0,0,0,0.03)] h-[calc(64px+env(safe-area-inset-bottom))]"
            role="navigation"
            aria-label="Mobile navigation"
        >
            {navItems.map((item) => {
                const active = isActive(item.href);

                return (
                    <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 w-16 h-full transition-all duration-300 relative",
                            active ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                        )}
                        aria-current={active ? "page" : undefined}
                    >
                        <div className={cn(
                            "relative p-1.5 rounded-xl transition-all duration-300",
                            active ? "bg-blue-50/50" : "bg-transparent"
                        )}>
                            <item.icon
                                className={cn(
                                    "w-6 h-6 transition-all duration-300",
                                    active ? "stroke-[2.5px] scale-105" : "stroke-[2px]"
                                )}
                            />
                        </div>
                        <span className={cn(
                            "text-[10px] font-medium tracking-wide transition-all",
                            active ? "font-semibold" : ""
                        )}>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

export default MobileNavigation;
