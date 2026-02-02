import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, Users, Clock, BarChart3, Calendar, Building2,
    Shield, Key, Settings, LogOut, ChevronLeft, ChevronRight,
    RefreshCw, Download, Bell, Menu, X, MoreHorizontal, FileText, UserCog
} from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
    const [nextRefresh, setNextRefresh] = useState(refreshInterval);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        toast({ title: "Logout berhasil", description: "Sampai jumpa kembali!" });
        navigate("/auth");
    };

    const handleManualRefresh = () => {
        onRefresh?.();
        setNextRefresh(refreshInterval);
        toast({ title: "Data diperbarui", description: "Dashboard telah di-refresh" });
    };

    const userName = user?.user_metadata?.full_name || "Administrator";

    // ADMIN MOBILE NAV ITEMS
    const adminMobileNav = [
        { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
        { icon: Users, label: "Karyawan", href: "/admin/karyawan" },
        { icon: FileText, label: "Laporan", href: "/admin/laporan" }, // Short for Reports
        { icon: MoreHorizontal, label: "Menu", href: "#menu" }, // Trigger for full menu
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-['Inter',system-ui,sans-serif] pb-24 lg:pb-0">
            {/* LIGHT SIDEBAR - DESKTOP ONLY */}
            <aside
                className={cn(
                    "hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col transition-all duration-300 ease-out",
                    "bg-white border-r border-slate-200 shadow-sm",
                    isCollapsed ? "w-[72px]" : "w-[260px]"
                )}
            >
                {/* Logo - Added Safe Area Support */}
                <div className="flex items-center h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br from-blue-700 to-sky-500"
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

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto bg-slate-50/50 scrollbar-thin">
                    {menuSections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-6">
                            {!isCollapsed && (
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
                                    {section.title}
                                </p>
                            )}
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive = location.pathname === item.href || (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
                                    return (
                                        <Link
                                            key={item.title}
                                            to={item.href}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                                                isActive ? "text-white shadow-md bg-gradient-to-br from-blue-700 to-sky-500" : "text-slate-600 hover:text-slate-800 hover:bg-white hover:shadow-sm"
                                            )}
                                        >
                                            <item.icon className={cn("h-5 w-5 flex-shrink-0 transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700")} />
                                            {!isCollapsed && <span className="truncate">{item.title}</span>}
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
                    className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                </button>

                {/* Profile */}
                <div className="p-3 border-t border-slate-100 bg-white">
                    <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm bg-gradient-to-br from-blue-700 via-sky-500 to-green-500 text-white font-semibold">
                            {getInitials(userName)}
                        </div>
                        {!isCollapsed && (
                            <>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
                                    <p className="text-xs text-slate-500">{roleLabel}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50">
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className={cn(
                "transition-all duration-300 ease-out min-h-screen",
                isCollapsed ? "md:ml-[72px]" : "md:ml-[260px]"
            )}>
                {/* Header - Relative (Non-Sticky) for Tablet/Desktop */}
                <header className="relative z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 lg:bg-white/95 transition-all pt-[env(safe-area-inset-top)]">
                    <div className="flex items-center h-16 px-4 lg:px-6 gap-4">
                        {/* Mobile Logo Only (Show on Mobile < md) */}
                        <div className="md:hidden flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center shadow-sm">
                                <img src={logoImage} alt="Logo" className="h-5 w-5 object-contain" />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg lg:text-xl font-bold text-slate-800 truncate">{title}</h1>
                            {subtitle && <p className="text-xs lg:text-sm text-slate-500 truncate hidden sm:block">{subtitle}</p>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {showRefresh && (
                                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span className="hidden md:inline">Auto: {nextRefresh}s</span>
                                </div>
                            )}
                            <Button size="sm" className="h-9 gap-2 text-white shadow-sm bg-gradient-to-r from-blue-700 to-sky-600 hover:to-sky-700 hidden sm:flex">
                                <Download className="h-4 w-4" /> Export
                            </Button>

                            {/* Mobile User Menu Trigger */}
                            <Button variant="ghost" size="icon" className="md:hidden text-slate-500" onClick={handleLogout}>
                                <LogOut className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Content Container with Safe Area Awareness & Bottom Nav Spacing */}
                <div className="p-4 lg:p-6 pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-6">
                    {children}
                </div>
            </main>

            {/* ADMIN MOBILE BOTTOM NAV (iOS Style) - Hidden on Tablet (md) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-around h-[64px] px-2 bg-gradient-to-t from-white/50 to-transparent">
                    {adminMobileNav.map((item) => {
                        const isActive = location.pathname === item.href || (item.href !== "/dashboard" && location.pathname.startsWith(item.href) && item.href !== "#menu");

                        if (item.href === "#menu") {
                            return (
                                <Sheet key={item.label} open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                                    <SheetTrigger asChild>
                                        <button className="flex flex-col items-center justify-center w-full h-full gap-1 text-slate-400 active:scale-95 transition-transform group">
                                            <div className="p-1.5 rounded-2xl group-active:bg-slate-100"><item.icon className="w-5 h-5 stroke-2" /></div>
                                            <span className="text-[10px] font-medium tracking-tight">Menu</span>
                                        </button>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="h-[85vh] rounded-t-[20px] p-0 flex flex-col">
                                        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50 rounded-t-[20px] shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center text-white font-bold shadow-md">{getInitials(userName)}</div>
                                            <div><p className="font-bold text-slate-800">{userName}</p><p className="text-xs text-slate-500 uppercase tracking-wide">{roleLabel}</p></div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 pb-20 grid grid-cols-2 gap-3 content-start">
                                            {menuSections.flatMap(s => s.items).map((menuItem) => (
                                                <Button
                                                    key={menuItem.title}
                                                    variant="outline"
                                                    className="h-auto py-5 flex flex-col gap-3 items-center justify-center bg-white border-slate-200 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all rounded-2xl"
                                                    onClick={() => {
                                                        navigate(menuItem.href);
                                                        setIsMobileMenuOpen(false);
                                                    }}
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                        <menuItem.icon className="w-6 h-6" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-700">{menuItem.title}</span>
                                                </Button>
                                            ))}
                                            <Button
                                                variant="destructive"
                                                className="col-span-2 mt-4 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 shadow-none h-12 rounded-xl"
                                                onClick={handleLogout}
                                            >
                                                <LogOut className="w-4 h-4 mr-2" /> Logout
                                            </Button>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            );
                        }

                        return (
                            <Link
                                key={item.label}
                                to={item.href}
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 active:scale-95 group",
                                    isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <div className={cn("relative p-1.5 rounded-2xl transition-colors", isActive && "bg-blue-50/80 shadow-sm")}>
                                    <item.icon className={cn("w-5 h-5 transition-transform", isActive ? "scale-105 stroke-[2.5px]" : "stroke-2 group-hover:scale-105")} />
                                </div>
                                <span className={cn("text-[10px] font-medium tracking-tight transition-colors", isActive ? "text-blue-700 font-semibold" : "text-slate-500")}>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default EnterpriseLayout;
