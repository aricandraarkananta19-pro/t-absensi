import { useState, useEffect } from "react";

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            // Check for iOS mobile viewport (iPhone)
            const isIOSMobile = window.matchMedia("(max-width: 430px)").matches;
            setIsMobile(isIOSMobile);
        };

        // Initial check
        checkIsMobile();

        // Listen for resize events
        window.addEventListener("resize", checkIsMobile);

        return () => window.removeEventListener("resize", checkIsMobile);
    }, []);

    return isMobile;
};

export const useIsIOS = () => {
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const checkIsIOS = () => {
            const ua = navigator.userAgent;
            const isIOSDevice = /iPad|iPhone|iPod/.test(ua) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
            const isMobileViewport = window.matchMedia("(max-width: 430px)").matches;

            setIsIOS(isIOSDevice || isMobileViewport);
        };

        checkIsIOS();
        window.addEventListener("resize", checkIsIOS);

        return () => window.removeEventListener("resize", checkIsIOS);
    }, []);

    return isIOS;
};
