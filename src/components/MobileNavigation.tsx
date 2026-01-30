import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, FileText, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

/**
 * iOS-Style Bottom Navigation (68px height + safe area)
 * 4 Items: Dashboard, Employees, Reports, Menu
 * - Fixed at bottom with safe area padding
 * - Icon + Label for each item
 * - Clear active state with brand color
 * - Minimum 44px tap target
 * - Doesn't overlap with content
 */
const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Users, label: "Karyawan", href: "/karyawan/absensi" },
    { icon: FileText, label: "Laporan", href: "/karyawan/riwayat" },
    { icon: Menu, label: "Menu", href: "/karyawan/profil" },
];

const MobileNavigation = () => {
    const location = useLocation();

    const isActive = (href: string) => {
        if (href === "/dashboard") {
            return location.pathname === "/dashboard" || location.pathname === "/";
        }
        return location.pathname === href || location.pathname.startsWith(href);
    };

    return (
        <nav
            className="ios-bottom-nav"
            role="navigation"
            aria-label="Mobile navigation"
        >
            {navItems.map((item) => {
                const active = isActive(item.href);

                return (
                    <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                            "ios-nav-item",
                            active && "active"
                        )}
                        aria-current={active ? "page" : undefined}
                    >
                        <div className="icon">
                            <item.icon
                                className={cn(
                                    "w-6 h-6 transition-all",
                                    active ? "stroke-[2.5px]" : "stroke-2"
                                )}
                            />
                        </div>
                        <span className="label">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

export default MobileNavigation;
