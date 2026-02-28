import React from 'react';
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Zap, Bell, User, LogOut, Key, FileText } from "lucide-react";
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
}

export default function KaryawanWorkspaceLayout({ children }: KaryawanWorkspaceLayoutProps) {
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
        { path: "/karyawan/cuti", label: "Time Off" },
        { path: "/karyawan/laporan", label: "Laporan" },
    ];

    return (
        <div className="min-h-screen bg-[#FAFAFC] font-['Inter',system-ui,sans-serif] pb-24 md:pb-12 text-slate-800">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-40">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform">
                                <Zap className="w-4 h-4 text-white fill-white" />
                            </div>
                            <span className="font-bold text-sm tracking-tight text-slate-900 hidden sm:block">T-Absensi</span>
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
                                                ? "bg-slate-100/80 text-slate-900 font-semibold"
                                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                        )}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2 rounded-full hover:bg-slate-50 text-slate-400 transition-colors">
                            <Bell className="w-4 h-4" />
                            {/* Example notification dot */}
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 rounded-full pl-2 pr-4 border border-slate-200 hover:bg-slate-50 gap-2 focus:ring-4 focus:ring-slate-100">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                                        {firstName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-xs font-semibold text-slate-700 hidden sm:block">{firstName}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-slate-100">
                                <DropdownMenuLabel className="font-normal p-2">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-semibold leading-none">{user?.user_metadata?.full_name || 'Karyawan'}</p>
                                        <p className="text-xs text-muted-foreground leading-none">Karyawan</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-slate-100" />
                                <DropdownMenuItem onClick={() => navigate('/karyawan/profil')} className="gap-2 cursor-pointer p-2 rounded-lg text-sm text-slate-600 font-medium">
                                    <User className="w-4 h-4" /> Profile view
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate('/edit-password')} className="gap-2 cursor-pointer p-2 rounded-lg text-sm text-slate-600 font-medium">
                                    <Key className="w-4 h-4" /> Setting Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-100" />
                                <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer text-red-600 hover:bg-red-50 p-2 rounded-lg text-sm font-medium">
                                    <LogOut className="w-4 h-4" /> Log out
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
