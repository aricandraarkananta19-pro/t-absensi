import { useState, useEffect } from "react";

/**
 * Mobile breakpoint: 768px
 * This covers all mobile devices including iPhone, Android phones, and small tablets
 * Admin paths are EXCLUDED from mobile layout - always use desktop
 */
const MOBILE_BREAKPOINT = 768;

// Admin paths that should NEVER use mobile layout
const ADMIN_PATHS = [
    "/admin",
    "/manager"
];

const isAdminPath = (): boolean => {
    if (typeof window === "undefined") return false;
    const pathname = window.location.pathname;
    return ADMIN_PATHS.some(path => pathname.startsWith(path));
};

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            // NEVER apply mobile UI to Admin/Manager routes
            if (isAdminPath()) {
                setIsMobile(false);
                return;
            }

            // Check for mobile viewport (≤ 768px)
            const isMobileViewport = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
            setIsMobile(isMobileViewport);
        };

        // Initial check
        checkIsMobile();

        // Listen for resize events
        window.addEventListener("resize", checkIsMobile);

        // Also listen for route changes (popstate)
        window.addEventListener("popstate", checkIsMobile);

        return () => {
            window.removeEventListener("resize", checkIsMobile);
            window.removeEventListener("popstate", checkIsMobile);
        };
    }, []);

    return isMobile;
};

export const useIsIOS = () => {
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const checkIsIOS = () => {
            // NEVER apply iOS-specific UI to Admin/Manager routes
            if (isAdminPath()) {
                setIsIOS(false);
                return;
            }

            const ua = navigator.userAgent;
            const isIOSDevice = /iPad|iPhone|iPod/.test(ua) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
            const isMobileViewport = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;

            setIsIOS(isIOSDevice && isMobileViewport);
        };

        checkIsIOS();
        window.addEventListener("resize", checkIsIOS);
        window.addEventListener("popstate", checkIsIOS);

        return () => {
            window.removeEventListener("resize", checkIsIOS);
            window.removeEventListener("popstate", checkIsIOS);
        };
    }, []);

    return isIOS;
};
