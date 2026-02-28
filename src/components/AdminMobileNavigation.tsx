import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Briefcase, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Beranda", href: "/dashboard" },
    { icon: Users, label: "Karyawan", href: "/admin/karyawan" },
    { icon: FileText, label: "Rekap", href: "/admin/absensi" },
    { icon: Briefcase, label: "Jurnal", href: "/admin/jurnal" },
    { icon: Settings, label: "Setelan", href: "/admin/pengaturan" },
];

const AdminMobileNavigation = () => {
    const location = useLocation();

    const isActive = (href: string) => {
        if (href === "/dashboard") {
            return location.pathname === "/dashboard" || location.pathname === "/";
        }
        return location.pathname === href || location.pathname.startsWith(href);
    };

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)] flex justify-between px-2 items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] h-[calc(64px+env(safe-area-inset-bottom))]"
            role="navigation"
            aria-label="Admin mobile navigation"
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
                            active ? "bg-slate-50" : "bg-transparent"
                        )}>
                            <item.icon
                                className={cn(
                                    "w-[22px] h-[22px] transition-all duration-300",
                                    active ? "stroke-[2.5px] scale-105 text-[#2563EB]" : "stroke-[2px] text-slate-400"
                                )}
                            />
                        </div>
                        <span className={cn(
                            "text-[10px] tracking-wide transition-all mt-0.5",
                            active ? "font-bold text-[#2563EB]" : "font-medium text-slate-500"
                        )}>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

export default AdminMobileNavigation;
