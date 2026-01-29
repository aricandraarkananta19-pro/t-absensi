import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
    BarChart3, Clock, Users, Building2, Shield, Key, Settings,
    LogOut, ChevronRight, ChevronLeft, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo.png";

interface MenuItem {
    icon: React.ElementType;
    title: string;
    href: string;
}

const menuItems: MenuItem[] = [
    { icon: BarChart3, title: "Dashboard", href: "/dashboard" },
    { icon: Users, title: "Karyawan", href: "/admin/karyawan" },
    { icon: Clock, title: "Absensi", href: "/admin/absensi" },
    { icon: BarChart3, title: "Laporan", href: "/admin/laporan" },
    { icon: Building2, title: "Departemen", href: "/admin/departemen" },
    { icon: Shield, title: "Role", href: "/admin/role" },
    { icon: Key, title: "Password", href: "/admin/reset-password" },
    { icon: Settings, title: "Pengaturan", href: "/admin/pengaturan" },
];

interface MiniSidebarProps {
    userInitials: string;
    onLogout: () => void;
}

export const MiniSidebar = ({ userInitials, onLogout }: MiniSidebarProps) => {
    const location = useLocation();
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            {/* Mini Sidebar - Icon Only (Tablet) */}
            <aside
                className={`fixed left-0 top-0 bottom-0 z-50 hidden md:flex lg:hidden flex-col transition-all duration-300 ${isExpanded ? "w-64" : "w-16"
                    }`}
            >
                {/* Glassmorphism Background */}
                <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800" />

                <div className="relative z-10 flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-4 border-b border-slate-800 flex items-center justify-center">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#0066b3] to-[#00aaff] flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <img src={logoImage} alt="Logo" className="h-6 w-6 object-contain" />
                        </div>
                        {isExpanded && (
                            <span className="ml-3 font-bold text-white animate-fade-in">Talenta</span>
                        )}
                    </div>

                    {/* Toggle Button */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="absolute -right-3 top-16 h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                        {isExpanded ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>

                    {/* Navigation */}
                    <nav className="flex-1 p-2 overflow-y-auto">
                        <div className="space-y-1">
                            {menuItems.map((item) => {
                                const isActive = location.pathname === item.href ||
                                    (item.href !== "/dashboard" && location.pathname.startsWith(item.href));

                                return (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all min-h-[44px] ${isActive
                                                ? "bg-gradient-to-r from-[#0066b3]/20 to-[#7dc242]/10 text-white border border-[#0066b3]/30"
                                                : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                            } ${isExpanded ? "" : "justify-center"}`}
                                        title={!isExpanded ? item.title : undefined}
                                    >
                                        <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-[#00aaff]" : ""}`} />
                                        {isExpanded && (
                                            <span className="text-sm font-medium truncate animate-fade-in">{item.title}</span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>

                    {/* User Profile */}
                    <div className="p-3 border-t border-slate-800">
                        <div className={`flex items-center ${isExpanded ? "gap-3" : "justify-center"}`}>
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0066b3] to-[#7dc242] flex items-center justify-center shadow-md flex-shrink-0">
                                <span className="text-sm font-semibold text-white">{userInitials}</span>
                            </div>
                            {isExpanded && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onLogout}
                                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 ml-auto animate-fade-in"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Spacer for content */}
            <div className={`hidden md:block lg:hidden transition-all duration-300 ${isExpanded ? "w-64" : "w-16"}`} />
        </>
    );
};

export default MiniSidebar;
