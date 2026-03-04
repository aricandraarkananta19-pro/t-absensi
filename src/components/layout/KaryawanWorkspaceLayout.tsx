import React from 'react';
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Zap, Bell, User, LogOut, Key, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";
import { cn } from "@/lib/utils";

interface KaryawanWorkspaceLayoutProps {
    children: React.ReactNode;
    isDark?: boolean;
    onToggleDark?: () => void;
    notifCount?: number;
}

export default function KaryawanWorkspaceLayout({ children, isDark = false, onToggleDark, notifCount = 0 }: KaryawanWorkspaceLayoutProps) {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const location = useLocation();

    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Karyawan';

    const handleLogout = async () => {
        await signOut();
        toast({ title: "Logout berhasil", description: "Sampai jumpa kembali!" });
        navigate("/auth");
    };

    const navLinks = [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/karyawan/jurnal", label: "Jurnal" },
        { path: "/karyawan/cuti", label: "Cuti" },
        { path: "/karyawan/laporan", label: "Laporan" },
    ];

    return (
        <div className={cn("min-h-screen font-['Inter',system-ui,sans-serif] pb-24 md:pb-12",
            isDark ? "bg-slate-900 text-white" : "bg-[#FAFAFC] text-slate-800")}>
            {/* Header */}
            <header className={cn("backdrop-blur-xl border-b sticky top-0 z-40",
                isDark ? "bg-slate-900/80 border-slate-700/50" : "bg-white/80 border-slate-200/50")}>
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-md hover:scale-105 transition-transform",
                                isDark ? "bg-indigo-600" : "bg-slate-900")}>
                                <Zap className="w-4 h-4 text-white fill-white" />
                            </div>
                            <span className={cn("font-bold text-sm tracking-tight hidden sm:block",
                                isDark ? "text-white" : "text-slate-900")}>T-Absensi</span>
                        </div>

                        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
                            {navLinks.map((link) => {
                                const isActive = location.pathname === link.path || (link.path !== '/karyawan' && location.pathname.startsWith(link.path));
                                return (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md transition-colors",
                                            isActive
                                                ? isDark ? "bg-slate-700/80 text-white font-semibold" : "bg-slate-100/80 text-slate-900 font-semibold"
                                                : isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                        )}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Dark Mode Toggle */}
                        {onToggleDark && (
                            <button
                                onClick={onToggleDark}
                                className={cn("p-2 rounded-full transition-colors",
                                    isDark ? "hover:bg-slate-800 text-slate-400 hover:text-amber-400" : "hover:bg-slate-50 text-slate-400 hover:text-slate-600")}>
                                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                        )}

                        {/* Bell with Notification Count */}
                        <button className={cn("relative p-2 rounded-full transition-colors",
                            isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-50 text-slate-400")}>
                            <Bell className="w-4 h-4" />
                            {notifCount > 0 ? (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 px-1">
                                    {notifCount > 9 ? '9+' : notifCount}
                                </span>
                            ) : (
                                <span className={cn("absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2",
                                    isDark ? "border-slate-900" : "border-white")}></span>
                            )}
                        </button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className={cn("relative h-9 rounded-full pl-2 pr-4 border gap-2 focus:ring-4",
                                    isDark ? "border-slate-700 hover:bg-slate-800 focus:ring-slate-700" : "border-slate-200 hover:bg-slate-50 focus:ring-slate-100")}>
                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                                        {firstName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className={cn("text-xs font-semibold hidden sm:block",
                                        isDark ? "text-slate-300" : "text-slate-700")}>{firstName}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className={cn("w-56 rounded-xl p-2 shadow-xl",
                                isDark ? "bg-slate-800 border-slate-700" : "border-slate-100")}>
                                <DropdownMenuLabel className="font-normal p-2">
                                    <div className="flex flex-col space-y-1">
                                        <p className={cn("text-sm font-semibold leading-none", isDark ? "text-white" : "")}>
                                            {user?.user_metadata?.full_name || 'Karyawan'}
                                        </p>
                                        <p className="text-xs text-muted-foreground leading-none">Karyawan</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className={isDark ? "bg-slate-700" : "bg-slate-100"} />
                                <DropdownMenuItem onClick={() => navigate('/karyawan/profil')} className={cn("gap-2 cursor-pointer p-2 rounded-lg text-sm font-medium",
                                    isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600")}>
                                    <User className="w-4 h-4" /> Lihat Profil
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate('/edit-password')} className={cn("gap-2 cursor-pointer p-2 rounded-lg text-sm font-medium",
                                    isDark ? "text-slate-300 hover:bg-slate-700" : "text-slate-600")}>
                                    <Key className="w-4 h-4" /> Ubah Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className={isDark ? "bg-slate-700" : "bg-slate-100"} />
                                <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-red-600 hover:bg-red-50 p-2 rounded-lg text-sm font-medium">
                                    <LogOut className="w-4 h-4" /> Keluar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto px-6 py-10 space-y-8 animate-in fade-in duration-500">
                {children}
            </main>

            {isMobile && <MobileNavigation />}
        </div>
    );
}
