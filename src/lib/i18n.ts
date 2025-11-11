import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files
import enTranslation from "../locales/en/translation.json";
import frTranslation from "../locales/fr/translation.json";

// Define available languages
export const LANGUAGES = {
  en: { code: "en", name: "English", nativeName: "English" },
  fr: { code: "fr", name: "French", nativeName: "Français" },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

// Configure i18next
i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    // Resources are the translation files
    resources: {
      en: {
        translation: enTranslation,
      },
      fr: {
        translation: frTranslation,
      },
    },
    // Fallback language if translation is missing
    fallbackLng: "en",
    // Default language
    lng: "en",
    // Debug mode (set to false in production)
    debug: process.env.NODE_ENV === "development",
    // Interpolation options
    interpolation: {
      // React already escapes values to prevent XSS
      escapeValue: false,
    },
    // Detection options
    detection: {
      // Order of language detection methods
      order: [
        "localStorage",
        "sessionStorage",
        "navigator",
        "htmlTag",
        "path",
        "subdomain",
      ],
      // Cache user language preference
      caches: ["localStorage", "sessionStorage"],
      // Cookie options
      cookieMinutes: 10080, // 7 days
    },
    // React options
    react: {
      // Use Suspense for async loading
      useSuspense: true,
    },
  });

// Export configured i18n instance
export default i18n;

// Helper function to get current language
export function getCurrentLanguage(): LanguageCode {
  const lang = i18n.language;
  return (lang.split("-")[0] as LanguageCode) || "en";
}

// Helper function to change language
export async function changeLanguage(lang: LanguageCode): Promise<void> {
  await i18n.changeLanguage(lang);
  // Update HTML lang attribute
  document.documentElement.lang = lang;
}

// Helper function to format date based on current locale
export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const currentLang = getCurrentLanguage();
  const dateObj = typeof date === "string" || typeof date === "number"
    ? new Date(date)
    : date;

  // If no options provided, use dateStyle
  // Otherwise, use the provided options (don't mix dateStyle with component options)
  const formatOptions = options && Object.keys(options).length > 0
    ? options
    : { dateStyle: "medium" as const };

  return new Intl.DateTimeFormat(currentLang, formatOptions).format(dateObj);
}

// Helper function to format relative time (e.g., "2 days ago")
export function formatRelativeTime(date: Date | string | number): string {
  const currentLang = getCurrentLanguage();
  const dateObj = typeof date === "string" || typeof date === "number"
    ? new Date(date)
    : date;

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(currentLang, { numeric: "auto" });

  // Define time units in seconds
  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "week", seconds: 604800 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 },
  ];

  // Find the appropriate unit
  for (const { unit, seconds } of units) {
    const value = Math.floor(diffInSeconds / seconds);
    if (Math.abs(value) >= 1) {
      return rtf.format(-value, unit);
    }
  }

  return rtf.format(0, "second");
}

// Helper function to format numbers based on current locale
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  const currentLang = getCurrentLanguage();
  return new Intl.NumberFormat(currentLang, options).format(value);
}

// Helper function to get all available languages
export function getAvailableLanguages() {
  return Object.values(LANGUAGES);
}
