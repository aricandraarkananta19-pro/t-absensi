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

/**
 * Mobile Bottom Navigation for Employee UI
 * - Fixed 64px height + safe-area padding for iOS
 * - Icons + labels for clear navigation
 * - Proper z-index to stay above content
 * - Never shown on Admin/Manager routes (handled by useIsMobile hook)
 */
const MobileNavigation = () => {
    const location = useLocation();

    return (
        <nav className="ios-bottom-nav" role="navigation" aria-label="Mobile navigation">
            {navItems.map((item) => {
                const isActive = location.pathname === item.href ||
                    (item.href === "/dashboard" && location.pathname === "/");

                return (
                    <Link
                        key={item.href}
                        to={item.href}
                        className={`ios-nav-item ${isActive ? "active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                    >
                        <div className="icon">
                            <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        <span className="label">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

export default MobileNavigation;

