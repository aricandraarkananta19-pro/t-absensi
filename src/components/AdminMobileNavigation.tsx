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
            className="fixed bottom-0 left-0 right-0 z-[100] pb-[env(safe-area-inset-bottom)]"
            role="navigation"
            aria-label="Admin mobile navigation"
        >
            {/* Glass background — consistent with other navigations */}
            <div className="absolute inset-0 bg-white dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/60" />

            <div className="relative flex justify-around items-center h-16 px-1 max-w-lg mx-auto">
                {navItems.map((item) => {
                    const active = isActive(item.href);

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className="flex flex-col items-center justify-center gap-0.5 w-[20%] py-1.5 transition-all duration-200 ease-in-out relative group"
                            aria-current={active ? "page" : undefined}
                        >
                            {/* Active indicator pill */}
                            {active && (
                                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-full" />
                            )}

                            <div className={cn(
                                "relative p-1.5 rounded-xl transition-all duration-200",
                                active ? "bg-indigo-50" : "bg-transparent group-active:bg-slate-50 dark:bg-slate-800"
                            )}>
                                <item.icon
                                    className={cn(
                                        "w-[22px] h-[22px] transition-all duration-200",
                                        active
                                            ? "text-indigo-600 stroke-[2.5px]"
                                            : "text-slate-400 stroke-[1.8px] group-active:text-slate-600 dark:text-slate-300"
                                    )}
                                />
                            </div>
                            <span className={cn(
                                "text-[10px] tracking-wide transition-all duration-200 leading-tight",
                                active ? "font-bold text-indigo-600" : "font-medium text-slate-400"
                            )}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default AdminMobileNavigation;
