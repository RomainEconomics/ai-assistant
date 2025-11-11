import { useState, useEffect } from "react";
import { Plus, MessageSquare, Trash2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProject, useCreateProject, useCreateConversation, useDeleteConversation } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { CreateProjectRequest, CreateConversationRequest } from "@/types/api";
import { AI_MODELS } from "@/types/api";
import { formatRelativeTime } from "@/lib/i18n";

interface ProjectsPageProps {
  selectedProjectId: number | null;
  onSelectProject: (projectId: number) => void;
  onSelectConversation: (conversationId: number) => void;
  showNewProjectForm: boolean;
  onCloseNewProjectForm: () => void;
}

export function ProjectsPage({
  selectedProjectId,
  onSelectProject,
  onSelectConversation,
  showNewProjectForm,
  onCloseNewProjectForm,
}: ProjectsPageProps) {
  const { t } = useTranslation();
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newConversationTitle, setNewConversationTitle] = useState("");
  const [selectedModel, setSelectedModel] = useState<{ provider: 'openai' | 'anthropic'; modelId: string }>({
    provider: 'openai',
    modelId: 'gpt-4o',
  });

  const { data: projectData } = useProject(selectedProjectId || 0);
  const createProject = useCreateProject();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  // Reset form when closing
  useEffect(() => {
    if (!showNewProjectForm) {
      setNewProjectName("");
      setNewProjectDescription("");
    }
  }, [showNewProjectForm]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    const projectReq: CreateProjectRequest = {
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
      is_private: true,
    };

    createProject.mutate(projectReq, {
      onSuccess: (project) => {
        setNewProjectName("");
        setNewProjectDescription("");
        onCloseNewProjectForm();
        onSelectProject(project.id);
      },
    });
  };

  const handleCreateConversation = async () => {
    if (!newConversationTitle.trim() || !selectedProjectId) return;

    const conversationData: CreateConversationRequest = {
      project_id: selectedProjectId,
      title: newConversationTitle.trim(),
      model_provider: selectedModel.provider,
      model_name: selectedModel.modelId,
    };

    createConversation.mutate(conversationData, {
      onSuccess: (conversation) => {
        setNewConversationTitle("");
        setShowNewConversation(false);
        onSelectConversation(conversation.id);
      },
    });
  };

  const handleDeleteConversation = (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('conversations.deleteConfirm'))) {
      deleteConversation.mutate(conversationId);
    }
  };

  // Show new project form
  if (showNewProjectForm) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{t('projects.createProject')}</CardTitle>
            <CardDescription>{t('projects.projectDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">{t('projects.projectName')} *</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('projects.searchPlaceholder')}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">{t('projects.projectDescription')}</Label>
              <Input
                id="project-description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder={t('projects.projectDescription')}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreateProject} disabled={!newProjectName.trim() || createProject.isPending}>
                {createProject.isPending ? t('common.loading') : t('projects.createProject')}
              </Button>
              <Button variant="outline" onClick={onCloseNewProjectForm}>
                {t('common.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show project view
  if (selectedProjectId && projectData) {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{projectData.project.name}</h1>
              {projectData.project.description && (
                <p className="text-muted-foreground mt-1">{projectData.project.description}</p>
              )}
            </div>
            <Button onClick={() => setShowNewConversation(!showNewConversation)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('conversations.newConversation')}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {/* New Conversation Form */}
            {showNewConversation && (
              <Card className="border-2 border-primary/50">
                <CardHeader>
                  <CardTitle className="text-lg">{t('conversations.createConversation')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="conversation-title">{t('conversations.conversationTitle')} *</Label>
                    <Input
                      id="conversation-title"
                      value={newConversationTitle}
                      onChange={(e) => setNewConversationTitle(e.target.value)}
                      placeholder={t('conversations.searchPlaceholder')}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateConversation()}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('conversations.selectModel')}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="provider" className="text-xs text-muted-foreground">{t('conversations.modelProvider')}</Label>
                        <select
                          id="provider"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={selectedModel.provider}
                          onChange={(e) =>
                            setSelectedModel({
                              provider: e.target.value as 'openai' | 'anthropic',
                              modelId: e.target.value === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022',
                            })
                          }
                        >
                          <option value="openai">{t('models.openai')}</option>
                          <option value="anthropic">{t('models.anthropic')}</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="model" className="text-xs text-muted-foreground">{t('settings.defaultModel')}</Label>
                        <select
                          id="model"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={selectedModel.modelId}
                          onChange={(e) => setSelectedModel({ ...selectedModel, modelId: e.target.value })}
                        >
                          {AI_MODELS[selectedModel.provider].map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateConversation}
                      disabled={!newConversationTitle.trim() || createConversation.isPending}
                    >
                      {createConversation.isPending ? t('common.loading') : t('conversations.createConversation')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewConversation(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversations List */}
            {projectData.conversations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="font-semibold text-lg mb-2">{t('conversations.emptyState')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('conversations.emptyState')}
                  </p>
                  <Button onClick={() => setShowNewConversation(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('conversations.createConversation')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {projectData.conversations.map((conversation) => (
                  <Card
                    key={conversation.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <h3 className="font-semibold truncate">{conversation.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-xs">
                              {conversation.model_provider === 'openai' ? t('models.openai') : t('models.anthropic')}
                            </Badge>
                            <span className="truncate">{conversation.model_name}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(conversation.updated_at)}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="flex-shrink-0"
                          onClick={(e) => handleDeleteConversation(conversation.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Show welcome screen
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <MessageSquare className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
          <h2 className="font-semibold text-2xl mb-2">{t('projects.title')}</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {t('projects.emptyState')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
