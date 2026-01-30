import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, Users, Clock, BarChart3, Calendar, Building2,
    Shield, Key, Settings, LogOut, ChevronLeft, ChevronRight,
    RefreshCw, Download, Bell, Search, Menu, X
} from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MenuItem {
    icon: React.ElementType;
    title: string;
    href: string;
    badge?: number;
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

interface EnterpriseLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    menuSections: MenuSection[];
    roleLabel?: string;
    showRefresh?: boolean;
    onRefresh?: () => void;
    refreshInterval?: number;
}

// Talenta Brand Colors
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

const EnterpriseLayout = ({
    children,
    title,
    subtitle,
    menuSections,
    roleLabel = "Admin",
    showRefresh = true,
    onRefresh,
    refreshInterval = 60,
}: EnterpriseLayoutProps) => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [nextRefresh, setNextRefresh] = useState(refreshInterval);

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
    };

    useEffect(() => {
        if (!showRefresh) return;

        const countdownInterval = setInterval(() => {
            setNextRefresh(prev => {
                if (prev <= 1) {
                    onRefresh?.();
                    return refreshInterval;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(countdownInterval);
    }, [showRefresh, refreshInterval, onRefresh]);

    const handleLogout = async () => {
        await signOut();
        toast({
            title: "Logout berhasil",
            description: "Sampai jumpa kembali!",
        });
        navigate("/auth");
    };

    const handleManualRefresh = () => {
        onRefresh?.();
        setNextRefresh(refreshInterval);
        toast({
            title: "Data diperbarui",
            description: "Dashboard telah di-refresh",
        });
    };

    const userName = user?.user_metadata?.full_name || "Administrator";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 font-['Inter',system-ui,sans-serif]">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* LIGHT SIDEBAR - Talenta Brand Theme */}
            <aside
                className={cn(
                    "fixed left-0 top-0 bottom-0 z-50 flex flex-col transition-all duration-300 ease-out",
                    "bg-white border-r border-slate-200 shadow-sm",
                    isCollapsed ? "w-[72px]" : "w-[260px]",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo - Light */}
                <div className="flex items-center h-16 px-4 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
                            style={{
                                background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                            }}
                        >
                            <img src={logoImage} alt="Logo" className="h-6 w-6 object-contain" />
                        </div>
                        {!isCollapsed && (
                            <div className="min-w-0 overflow-hidden">
                                <h1 className="font-bold text-slate-800 text-base leading-none truncate">Talenta Traincom</h1>
                                <p className="text-xs text-slate-500 leading-tight mt-0.5">Enterprise HRIS</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation - Light */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto bg-slate-50/50">
                    {menuSections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-6">
                            {!isCollapsed && (
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
                                    {section.title}
                                </p>
                            )}
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive = location.pathname === item.href ||
                                        (item.href !== "/dashboard" && location.pathname.startsWith(item.href));

                                    return (
                                        <Link
                                            key={item.title}
                                            to={item.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                                                isActive
                                                    ? "text-white shadow-md"
                                                    : "text-slate-600 hover:text-slate-800 hover:bg-white hover:shadow-sm"
                                            )}
                                            style={isActive ? {
                                                background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                                            } : undefined}
                                        >
                                            <item.icon className={cn(
                                                "h-5 w-5 flex-shrink-0 transition-colors",
                                                isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700"
                                            )} />
                                            {!isCollapsed && (
                                                <span className="truncate">{item.title}</span>
                                            )}
                                            {!isCollapsed && item.badge && item.badge > 0 && (
                                                <span
                                                    className="ml-auto px-2 py-0.5 text-xs font-semibold text-white rounded-full"
                                                    style={{ backgroundColor: BRAND_COLORS.green }}
                                                >
                                                    {item.badge}
                                                </span>
                                            )}
                                            {isCollapsed && (
                                                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                                                    {item.title}
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Collapse Toggle */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                </button>

                {/* User Profile - Light */}
                <div className="p-3 border-t border-slate-100 bg-white">
                    <div className={cn(
                        "flex items-center gap-3",
                        isCollapsed && "justify-center"
                    )}>
                        <div
                            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
                            style={{
                                background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.green} 100%)`
                            }}
                        >
                            <span className="text-sm font-semibold text-white">
                                {getInitials(userName)}
                            </span>
                        </div>
                        {!isCollapsed && (
                            <>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
                                    <p className="text-xs text-slate-500">{roleLabel}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleLogout}
                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                    title="Logout"
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn(
                "transition-all duration-300 ease-out",
                isCollapsed ? "lg:ml-[72px]" : "lg:ml-[260px]"
            )}>
                {/* Header - Light */}
                <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
                    <div className="flex items-center h-full px-4 lg:px-6 gap-4">
                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-bold text-slate-800 truncate">{title}</h1>
                            {subtitle && (
                                <p className="text-sm text-slate-500 truncate hidden sm:block">{subtitle}</p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Refresh Indicator */}
                            {showRefresh && (
                                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span className="hidden md:inline">Auto-refresh:</span>
                                    <span className="font-medium">{nextRefresh}s</span>
                                </div>
                            )}

                            {/* Manual Refresh */}
                            {onRefresh && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleManualRefresh}
                                    className="h-9 gap-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    <span className="hidden sm:inline">Refresh</span>
                                </Button>
                            )}

                            {/* Export Button - Brand Color */}
                            <Button
                                size="sm"
                                className="h-9 gap-2 text-white shadow-md hover:shadow-lg transition-all"
                                style={{
                                    background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                                }}
                            >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Export</span>
                            </Button>

                            {/* Notifications */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:hidden text-slate-500 hover:text-slate-700"
                            >
                                <Bell className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-4 lg:p-6">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 lg:hidden z-30 pb-safe">
                <div className="flex h-full items-center justify-around px-2">
                    {menuSections[0]?.items.slice(0, 4).map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.title}
                                to={item.href}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[64px]",
                                    isActive ? "text-white" : "text-slate-500"
                                )}
                                style={isActive ? { color: BRAND_COLORS.blue } : undefined}
                            >
                                <item.icon className="h-5 w-5" />
                                <span className="text-[10px] font-medium truncate">{item.title.split(" ")[0]}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default EnterpriseLayout;
