import { Sun, Moon, Monitor, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const themeOptions: Array<{
  value: ThemeMode;
  labelKey: string;
  icon: typeof Sun;
}> = [
  { value: "light", labelKey: "settings.theme.light", icon: Sun },
  { value: "dark", labelKey: "settings.theme.dark", icon: Moon },
  { value: "system", labelKey: "settings.theme.system", icon: Monitor },
];

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme, setTheme, isUpdating, resolvedTheme } = useTheme();

  const handleThemeChange = async (newTheme: ThemeMode) => {
    if (newTheme === theme) return;

    try {
      await setTheme(newTheme);
      toast.success(t("settings.theme.updated"));
    } catch (error) {
      toast.error(t("settings.theme.updateFailed"));
    }
  };

  const currentThemeOption = themeOptions.find(
    (option) => option.value === theme
  ) || themeOptions[2]; // Default to system

  const CurrentIcon = currentThemeOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={isUpdating}>
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CurrentIcon className="h-4 w-4" />
          )}
          <span className="sr-only">{t("settings.theme.change")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themeOptions.map((option) => {
          const OptionIcon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleThemeChange(option.value)}
              className="flex items-center justify-between gap-2"
              disabled={isUpdating}
            >
              <div className="flex items-center gap-2">
                <OptionIcon className="h-4 w-4" />
                <span>{t(option.labelKey)}</span>
              </div>
              {theme === option.value && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
