import { useLocation, Link } from "react-router-dom";
import { Home, Clock, Calendar, FileText, User } from "lucide-react";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

const navItems: NavItem[] = [
    { icon: Home, label: "Beranda", href: "/dashboard" },
    { icon: Clock, label: "Absensi", href: "/karyawan/absensi" },
    { icon: Calendar, label: "Riwayat", href: "/karyawan/riwayat" },
    { icon: FileText, label: "Cuti", href: "/karyawan/cuti" },
    { icon: User, label: "Profil", href: "/karyawan/profil" },
];

const MobileNavigation = () => {
    const location = useLocation();

    return (
        <nav className="ios-bottom-nav">
            {navItems.map((item) => {
                const isActive = location.pathname === item.href ||
                    (item.href === "/dashboard" && location.pathname === "/");

                return (
                    <Link
                        key={item.href}
                        to={item.href}
                        className={`ios-nav-item ${isActive ? "active" : ""}`}
                    >
                        <div className="icon">
                            <item.icon className="h-6 w-6" />
                        </div>
                        <span className="label">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

export default MobileNavigation;
