import { useEffect } from "react";
import { useTheme as useNextTheme } from "next-themes";
import { useSettings, useUpdateSettings } from "./useApi";

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Hook to sync theme between next-themes and backend user preferences
 *
 * This hook:
 * 1. Loads user theme preference from backend on mount
 * 2. Updates next-themes when backend preference changes
 * 3. Provides a function to change theme that updates both next-themes and backend
 */
export function useTheme() {
  const { theme, setTheme: setNextTheme, systemTheme } = useNextTheme();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  // Sync next-themes with backend preference on load
  useEffect(() => {
    if (settings?.theme && theme !== settings.theme) {
      setNextTheme(settings.theme);
    }
  }, [settings?.theme, theme, setNextTheme]);

  // Function to change theme and persist to backend
  const setTheme = async (newTheme: ThemeMode) => {
    try {
      // Update next-themes immediately for instant UI feedback
      setNextTheme(newTheme);

      // Persist to backend
      await updateSettings.mutateAsync({ theme: newTheme });
    } catch (error) {
      console.error("Failed to update theme preference:", error);
      // Revert next-themes change if backend update fails
      if (settings?.theme) {
        setNextTheme(settings.theme);
      }
      throw error;
    }
  };

  // Get the resolved theme (light or dark)
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  return {
    theme: (theme || 'system') as ThemeMode,
    resolvedTheme: (resolvedTheme || 'light') as 'light' | 'dark',
    setTheme,
    isLoading,
    isUpdating: updateSettings.isPending,
  };
}
