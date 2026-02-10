
import {
    LayoutDashboard,
    Users,
    Clock,
    Briefcase,
    BarChart3,
    Building2,
    Shield,
    Key,
    Settings,
    Database,
    FileCheck
} from "lucide-react";

export const ADMIN_MENU_SECTIONS = [
    {
        title: "Menu Utama",
        items: [
            { icon: LayoutDashboard, title: "Dashboard", href: "/dashboard" },
            { icon: Users, title: "Kelola Karyawan", href: "/admin/karyawan" },
            { icon: Clock, title: "Rekap Absensi", href: "/admin/absensi" },
            { icon: Briefcase, title: "Jurnal Kerja", href: "/admin/jurnal" },
            { icon: BarChart3, title: "Laporan", href: "/admin/laporan" },
        ],
    },
    {
        title: "Pengaturan",
        items: [
            { icon: Building2, title: "Departemen", href: "/admin/departemen" },
            { icon: Shield, title: "Kelola Role", href: "/admin/role" },
            { icon: Key, title: "Reset Password", href: "/admin/reset-password" },
            { icon: Settings, title: "Pengaturan", href: "/admin/pengaturan" },
            { icon: Database, title: "Export Database", href: "/admin/export-database" },
        ],
    },
];

export const MANAGER_MENU_SECTIONS = [
    {
        title: "Menu Utama",
        items: [
            { icon: LayoutDashboard, title: "Dashboard", href: "/manager" },
            { icon: Clock, title: "Rekap Absensi", href: "/manager/absensi" },
            { icon: Briefcase, title: "Jurnal Tim", href: "/manager/jurnal" },
            { icon: BarChart3, title: "Laporan", href: "/manager/laporan" },
            { icon: FileCheck, title: "Kelola Cuti", href: "/manager/cuti" },
        ],
    },
];
