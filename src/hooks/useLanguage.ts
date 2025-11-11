import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSettings } from "./useApi";
import { changeLanguage, type LanguageCode } from "@/lib/i18n";

/**
 * Hook to sync language between i18n and backend user preferences
 *
 * This hook:
 * 1. Loads user language preference from backend on mount
 * 2. Updates i18n when backend preference changes
 * 3. Provides a function to change language that updates both i18n and backend
 */
export function useLanguage() {
  const { i18n } = useTranslation();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  // Sync i18n with backend preference on load
  useEffect(() => {
    if (settings?.language && i18n.language !== settings.language) {
      changeLanguage(settings.language as LanguageCode);
    }
  }, [settings?.language, i18n.language]);

  // Function to change language and persist to backend
  const setLanguage = async (language: LanguageCode) => {
    try {
      // Update i18n immediately for instant UI feedback
      await changeLanguage(language);

      // Persist to backend
      await updateSettings.mutateAsync({ language });
    } catch (error) {
      console.error("Failed to update language preference:", error);
      // Optionally revert i18n change if backend update fails
      if (settings?.language) {
        await changeLanguage(settings.language as LanguageCode);
      }
      throw error;
    }
  };

  return {
    currentLanguage: i18n.language.split("-")[0] as LanguageCode,
    setLanguage,
    isLoading,
    isUpdating: updateSettings.isPending,
  };
}
