import { Link, useLocation } from "react-router-dom";
import { BarChart3, Clock, Users, User } from "lucide-react";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

const navItems: NavItem[] = [
    { icon: BarChart3, label: "Dashboard", href: "/dashboard" },
    { icon: Clock, label: "Absensi", href: "/admin/absensi" },
    { icon: Users, label: "Karyawan", href: "/admin/karyawan" },
    { icon: User, label: "Profil", href: "/admin/pengaturan" },
];

export const BottomNavigation = () => {
    const location = useLocation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
            {/* Glassmorphism background */}
            <div className="mx-3 mb-3 rounded-2xl bg-white/90 backdrop-blur-md border border-white/20 shadow-2xl shadow-slate-900/20">
                {/* Safe area padding for iPhone home indicator */}
                <div className="flex items-center justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.href ||
                            (item.href !== "/dashboard" && location.pathname.startsWith(item.href));

                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] px-3 py-1.5 rounded-xl transition-all ${isActive
                                        ? "bg-gradient-to-r from-[#0066b3]/10 to-[#7dc242]/10 text-[#0066b3]"
                                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                    }`}
                            >
                                <item.icon className={`h-5 w-5 ${isActive ? "text-[#0066b3]" : ""}`} />
                                <span className={`text-xs mt-0.5 font-medium ${isActive ? "text-[#0066b3]" : ""}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

export default BottomNavigation;
