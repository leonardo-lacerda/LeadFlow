"use client";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "leadflow-theme";

const applyTheme = (theme: Theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
};

export function ThemeToggle() {
    const handleToggleTheme = () => {
        const isDarkTheme = document.documentElement.classList.contains("dark");
        const nextTheme: Theme = isDarkTheme ? "light" : "dark";
        applyTheme(nextTheme);
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleTheme}
            aria-label="Alternar tema"
            title="Alternar tema"
            type="button"
        >
            <IconSun className="hidden h-5 w-5 dark:block" />
            <IconMoon className="block h-5 w-5 dark:hidden" />
        </Button>
    );
}
