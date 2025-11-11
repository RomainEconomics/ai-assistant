import { Languages, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getAvailableLanguages, type LanguageCode } from "@/lib/i18n";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

export function LanguageSwitcher() {
  const { currentLanguage, setLanguage, isUpdating } = useLanguage();
  const languages = getAvailableLanguages();

  const handleLanguageChange = async (langCode: LanguageCode) => {
    if (langCode === currentLanguage) return;

    try {
      await setLanguage(langCode);
      toast.success("Language updated successfully");
    } catch (error) {
      toast.error("Failed to update language preference");
    }
  };

  const currentLangObj = languages.find(
    (lang) => lang.code === currentLanguage
  ) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={isUpdating}>
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Languages className="h-4 w-4" />
          )}
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className="flex items-center justify-between gap-2"
            disabled={isUpdating}
          >
            <span>{language.nativeName}</span>
            {currentLangObj.code === language.code && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
