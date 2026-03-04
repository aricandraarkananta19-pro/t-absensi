import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
}

interface ThemeProviderState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    isDark: boolean;
    toggleTheme: () => void;
}

const initialState: ThemeProviderState = {
    theme: 'light',
    setTheme: () => null,
    isDark: false,
    toggleTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = 'light',
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem('vite-ui-theme') as Theme) || defaultTheme
    );

    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove('light', 'dark');
        root.classList.add(theme);
    }, [theme]);

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem('vite-ui-theme', theme);
            setTheme(theme);
        },
        isDark: theme === 'dark',
        toggleTheme: () => {
            const newTheme = theme === 'light' ? 'dark' : 'light';
            localStorage.setItem('vite-ui-theme', newTheme);
            setTheme(newTheme);
        }
    };

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined)
        throw new Error('useTheme must be used within a ThemeProvider');

    return context;
};
