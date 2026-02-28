
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    showExport?: boolean;
    isExporting?: boolean;
    onExport?: () => void;
    customExportNode?: React.ReactNode;
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
    showExport = true,
    isExporting = false,
    onExport,
    customExportNode
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
        /*
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
        */
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
        <div className="min-h-screen bg-slate-50/80 font-['Inter',system-ui,sans-serif] pb-24 lg:pb-0 relative overflow-x-hidden">
            {/* Background Graphic Abstract - Subtle SaaS Effect */}
            <div className="fixed top-0 right-0 -z-10 w-[50vw] h-[40vh] bg-blue-100/30 rounded-full blur-[120px] pointer-events-none opacity-60 transform translate-x-1/3 -translate-y-1/4"></div>
            <div className="fixed bottom-0 left-0 -z-10 w-[40vw] h-[35vh] bg-indigo-100/20 rounded-full blur-[120px] pointer-events-none opacity-50 transform -translate-x-1/3 translate-y-1/4"></div>
            {/* LIGHT SIDEBAR - DESKTOP ONLY */}
            <aside
                className={cn(
                    "hidden md:flex fixed left-0 top-0 bottom-0 z-50 flex-col transition-all duration-300 ease-out",
                    "bg-white/80 backdrop-blur-xl border-r border-slate-200/60 shadow-sm",
                    isCollapsed ? "w-[72px]" : "w-[240px]"
                )}
            >
                {/* Logo - Added Safe Area Support */}
                <div className="flex items-center h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 border-b border-slate-100/80 bg-white/50">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br from-slate-800 to-slate-600"
                        >
                            <img src={logoImage} alt="Logo" className="h-6 w-6 object-contain" />
                        </div>
                        {!isCollapsed && (
                            <div className="min-w-0 overflow-hidden">
                                <h1 className="font-extrabold text-slate-800 text-sm leading-none truncate tracking-tight">Talenta Traincom</h1>
                                <p className="text-[10px] text-slate-400 leading-tight mt-1 font-medium tracking-wider uppercase">Enterprise HRIS</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto vibe-scrollbar">
                    {menuSections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-6">
                            {!isCollapsed && (
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
                                    {section.title}
                                </p>
                            )}
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const isActive = location.pathname === item.href || (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
                                    return (
                                        <Link
                                            key={item.title}
                                            to={item.href}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative overflow-hidden",
                                                isActive
                                                    ? "text-primary bg-primary/5 font-semibold"
                                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium"
                                            )}
                                        >
                                            {/* Left Accent Indicator */}
                                            {isActive && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/4 bg-primary rounded-r-full" />
                                            )}

                                            <div className={cn(
                                                "flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200",
                                                isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
                                            )}>
                                                <item.icon className="h-4 w-4 flex-shrink-0" />
                                            </div>
                                            {!isCollapsed && <span className="truncate">{item.title}</span>}
                                            {!isCollapsed && item.badge && item.badge > 0 && (
                                                <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{item.badge}</span>
                                            )}
                                            {isCollapsed && (
                                                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
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
                    className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200/60 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95"
                >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                </button>

                {/* Profile Profile simplified at bottom */}
                <div className="p-3 border-t border-slate-100 bg-white/50">
                    <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
                        <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                            {getInitials(userName)}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{userName}</p>
                                <p className="text-[11px] text-slate-500 font-medium truncate">{roleLabel}</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className={cn(
                "transition-all duration-300 ease-out min-h-screen",
                isCollapsed ? "md:ml-[72px]" : "md:ml-[240px]"
            )}>
                {/* Header - Modern Top Nav */}
                <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/50 pt-[env(safe-area-inset-top)]">
                    <div className="flex items-center justify-between h-16 px-4 lg:px-8">
                        <div className="flex items-center gap-4">
                            {/* Mobile Logo Only */}
                            <div className="md:hidden flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-sm">
                                    <img src={logoImage} alt="Logo" className="h-5 w-5 object-contain" />
                                </div>
                            </div>

                            {/* Global Search */}
                            <div className="hidden md:flex items-center bg-slate-100/50 rounded-full px-3 py-1.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20 transition-all border border-transparent focus-within:border-primary/20 w-64">
                                <Menu className="w-4 h-4 text-slate-400 mr-2" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="bg-transparent border-none outline-none text-sm text-slate-700 w-full placeholder:text-slate-400 h-6"
                                />
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm ml-2">
                                    <span>⌘</span><span>K</span>
                                </div>
                            </div>
                        </div>

                        {/* Top Nav Actions */}
                        <div className="flex items-center gap-4">
                            {showRefresh && (
                                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer transition-colors" onClick={handleManualRefresh}>
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </div>
                            )}

                            <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full h-9 w-9">
                                <Bell className="h-4 w-4" />
                                <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-9 rounded-full pl-2 pr-4 border border-slate-200 hover:bg-slate-50 gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                            {getInitials(userName)}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-700 hidden sm:block">{userName.split(' ')[0]}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 font-['Inter'] rounded-xl p-2 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border-slate-100">
                                    <DropdownMenuLabel className="font-normal p-2">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-semibold leading-none">{userName}</p>
                                            <p className="text-xs text-muted-foreground leading-none">{roleLabel}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-slate-100" />
                                    <DropdownMenuItem className="gap-2 cursor-pointer p-2 rounded-lg text-sm">
                                        <UserCog className="w-4 h-4 text-slate-500" />
                                        Profile Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="gap-2 cursor-pointer p-2 rounded-lg text-sm">
                                        <Settings className="w-4 h-4 text-slate-500" />
                                        Preferences
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-slate-100" />
                                    <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg text-sm font-medium">
                                        <LogOut className="w-4 h-4" />
                                        Log out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                {/* Content Container with Safe Area Awareness & Bottom Nav Spacing */}
                <div className="p-4 lg:p-6 pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-6 vibe-page-enter">
                    {children}
                </div>
            </main>

            {/* ADMIN MOBILE BOTTOM NAV (iOS Style Premium) - Hidden on Tablet (md) upwards */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-t border-slate-200/50 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center justify-around h-[66px] px-4">
                    {adminMobileNav.map((item) => {
                        const isActive = location.pathname === item.href || (item.href !== "/dashboard" && location.pathname.startsWith(item.href) && item.href !== "#menu");

                        if (item.href === "#menu") {
                            return (
                                <Sheet key={item.label} open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                                    <SheetTrigger asChild>
                                        <button className="flex flex-col items-center justify-center gap-1 text-slate-400 active:scale-95 transition-all outline-none">
                                            <div className="p-2 rounded-2xl bg-slate-50 text-slate-500"><item.icon className="w-5 h-5" /></div>
                                            <span className="text-[10px] font-medium">Menu</span>
                                        </button>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="h-[85vh] rounded-t-[28px] p-0 flex flex-col border-0 shadow-2xl">
                                        {/* Header */}
                                        <div className="px-6 py-5 border-b border-slate-100/80 flex items-center gap-4 bg-slate-50/30 rounded-t-[28px]">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                                {getInitials(userName)}
                                            </div>
                                            <div>
                                                <p className="font-extrabold text-slate-800 text-lg tracking-tight">{userName}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{roleLabel}</p>
                                            </div>
                                        </div>

                                        {/* Grid Menu */}
                                        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 gap-3 content-start bg-white">
                                            {menuSections.flatMap(s => s.items).map((menuItem) => (
                                                <Button
                                                    key={menuItem.title}
                                                    variant="ghost"
                                                    className="h-auto py-5 flex flex-col gap-3 items-center justify-center bg-slate-50/70 border border-slate-100/80 shadow-sm hover:bg-white hover:border-slate-200 hover:shadow-md active:scale-[0.97] transition-all rounded-2xl group"
                                                    onClick={() => {
                                                        navigate(menuItem.href);
                                                        setIsMobileMenuOpen(false);
                                                    }}
                                                >
                                                    <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-100 transition-colors shadow-sm border border-slate-100/50">
                                                        <menuItem.icon className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-800">{menuItem.title}</span>
                                                </Button>
                                            ))}
                                        </div>

                                        {/* Logout Button */}
                                        <div className="p-5 border-t border-slate-100/80 bg-white pb-[calc(24px+env(safe-area-inset-bottom))]">
                                            <Button
                                                variant="destructive"
                                                className="w-full bg-red-50 text-red-600 hover:bg-red-100 border border-red-100/80 shadow-none h-12 rounded-xl font-bold"
                                                onClick={handleLogout}
                                            >
                                                <LogOut className="w-4 h-4 mr-2" /> Keluar Aplikasi
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
                                    "flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95",
                                    isActive ? "text-blue-600" : "text-slate-400"
                                )}
                            >
                                <div className={cn(
                                    "relative p-2 rounded-2xl transition-all duration-300",
                                    isActive ? "bg-blue-50 text-blue-600 shadow-sm" : "hover:bg-slate-50"
                                )}>
                                    <item.icon className={cn("w-5 h-5 transition-transform", isActive && "scale-105 stroke-[2.5px]")} />
                                    {isActive && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                                    )}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-medium tracking-tight transition-all",
                                    isActive ? "text-blue-700 font-semibold" : "text-slate-500"
                                )}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default EnterpriseLayout;
