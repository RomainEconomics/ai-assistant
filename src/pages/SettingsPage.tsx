import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSettings, useModels } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";

export function SettingsPage() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useSettings();
  const { data: models } = useModels();
  const updateSettings = useUpdateSettings();

  const [formData, setFormData] = useState({
    default_model_provider: '',
    default_model_name: '',
    default_temperature: 0.7,
    default_max_tokens: 2000,
    theme: 'light',
    language: 'en',
  });

  const [saved, setSaved] = useState(false);

  // Initialize form with current settings
  useEffect(() => {
    if (settings) {
      setFormData({
        default_model_provider: settings.default_model_provider || '',
        default_model_name: settings.default_model_name || '',
        default_temperature: settings.default_temperature,
        default_max_tokens: settings.default_max_tokens,
        theme: settings.theme,
        language: settings.language,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(formData);
      setSaved(true);
      toast.success(t('notifications.settingsSaved'));
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error(t('errors.generic'));
      console.error("Error saving settings:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  const openaiModels = models?.models?.find((m: any) => m.provider === 'openai')?.models || [];
  const anthropicModels = models?.models?.find((m: any) => m.provider === 'anthropic')?.models || [];
  const currentProviderModels = formData.default_model_provider === 'openai' ? openaiModels : anthropicModels;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('settings.general')}
          </p>
        </div>

        <Separator />

        <Tabs defaultValue="model" className="space-y-6">
          <TabsList>
            <TabsTrigger value="model">{t('settings.defaultModel')}</TabsTrigger>
            <TabsTrigger value="appearance">{t('settings.appearance')}</TabsTrigger>
            <TabsTrigger value="language">{t('settings.language')}</TabsTrigger>
          </TabsList>

          {/* Model Defaults Tab */}
          <TabsContent value="model" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.defaultModelSettings')}</CardTitle>
                <CardDescription>
                  {t('settings.defaultModelDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">{t('settings.modelProvider')}</Label>
                  <Select
                    value={formData.default_model_provider}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        default_model_provider: value,
                        default_model_name: '', // Reset model name when provider changes
                      });
                    }}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue placeholder={t('settings.selectProvider')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">{t('models.openai')}</SelectItem>
                      <SelectItem value="anthropic">{t('models.anthropic')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.providerDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">{t('settings.defaultModel')}</Label>
                  <Select
                    value={formData.default_model_name}
                    onValueChange={(value) => {
                      setFormData({ ...formData, default_model_name: value });
                    }}
                    disabled={!formData.default_model_provider}
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder={t('settings.selectModel')} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentProviderModels.map((model: any) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.selectModelDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">{t('settings.temperature')}: {formData.default_temperature}</Label>
                  <Input
                    id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.default_temperature}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        default_temperature: parseFloat(e.target.value),
                      });
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('settings.temperatureDescription')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTokens">{t('settings.maxTokens')}</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min="1"
                    max="100000"
                    value={formData.default_max_tokens}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        default_max_tokens: parseInt(e.target.value) || 2000,
                      });
                    }}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('settings.maxTokensDescription')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.themeSettings')}</CardTitle>
                <CardDescription>
                  {t('settings.themeDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">{t('settings.theme.title')}</Label>
                  <Select
                    value={formData.theme}
                    onValueChange={(value: 'light' | 'dark' | 'system') => {
                      setFormData({ ...formData, theme: value });
                    }}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                      <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                      <SelectItem value="system">{t('settings.theme.system')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.themeChoice')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Language Tab */}
          <TabsContent value="language" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.languagePreferences')}</CardTitle>
                <CardDescription>
                  {t('settings.languageDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">{t('settings.interfaceLanguage')}</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value: 'en' | 'fr') => {
                      setFormData({ ...formData, language: value });
                    }}
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.languageChoice')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending || saved}
            size="lg"
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('settings.saving')}
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t('settings.saved')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t('settings.saveSettings')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
