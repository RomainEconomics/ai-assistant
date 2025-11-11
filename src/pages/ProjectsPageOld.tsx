import { useState } from "react";
import { Plus, FolderOpen, MessageSquare, Trash2 } from "lucide-react";
import { useProjects, useProject, useCreateProject, useDeleteProject, useCreateConversation } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateProjectRequest, CreateConversationRequest } from "@/types/api";
import { AI_MODELS } from "@/types/api";

interface ProjectsPageProps {
  selectedProjectId: number | null;
  onSelectProject: (projectId: number) => void;
  onSelectConversation: (conversationId: number) => void;
}

export function ProjectsPage({ selectedProjectId, onSelectProject, onSelectConversation }: ProjectsPageProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newConversationTitle, setNewConversationTitle] = useState("");
  const [selectedModel, setSelectedModel] = useState<{ provider: 'openai' | 'anthropic'; modelId: string }>({
    provider: 'openai',
    modelId: 'gpt-4o',
  });

  const { data: projects, isLoading: loadingProjects } = useProjects();
  const { data: projectData } = useProject(selectedProjectId || 0);
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const createConversation = useCreateConversation();

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    const projectData: CreateProjectRequest = {
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
      is_private: true,
    };

    createProject.mutate(projectData, {
      onSuccess: (project) => {
        setNewProjectName("");
        setNewProjectDescription("");
        setShowNewProject(false);
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

  const handleDeleteProject = (projectId: number) => {
    if (confirm("Are you sure you want to delete this project? All conversations will be deleted.")) {
      deleteProject.mutate(projectId, {
        onSuccess: () => {
          if (selectedProjectId === projectId) {
            onSelectProject(0);
          }
        },
      });
    }
  };

  if (loadingProjects) {
    return <div>Loading projects...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Projects List */}
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Projects</CardTitle>
              <Button size="sm" onClick={() => setShowNewProject(!showNewProject)}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {showNewProject && (
              <div className="p-3 border rounded-lg space-y-2 bg-muted/50">
                <div className="space-y-1">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                    id="project-name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="project-description">Description (optional)</Label>
                  <Input
                    id="project-description"
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Project description"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateProject} disabled={!newProjectName.trim()}>
                    Create
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNewProject(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {projects && projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No projects yet. Create one to get started!
              </p>
            ) : (
              projects?.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedProjectId === project.id ? "bg-muted border-primary" : ""
                  }`}
                  onClick={() => onSelectProject(project.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        <h3 className="font-medium">{project.name}</h3>
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversations List */}
      <div className="md:col-span-2">
        {selectedProjectId && projectData ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{projectData.project.name}</CardTitle>
                  <CardDescription>Select a conversation or create a new one</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowNewConversation(!showNewConversation)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Conversation
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {showNewConversation && (
                <div className="p-3 border rounded-lg space-y-3 bg-muted/50">
                  <div className="space-y-1">
                    <Label htmlFor="conversation-title">Title</Label>
                    <Input
                      id="conversation-title"
                      value={newConversationTitle}
                      onChange={(e) => setNewConversationTitle(e.target.value)}
                      placeholder="Conversation title"
                      onKeyDown={(e) => e.key === "Enter" && handleCreateConversation()}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Model</Label>
                    <div className="flex gap-2">
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={selectedModel.provider}
                        onChange={(e) =>
                          setSelectedModel({
                            provider: e.target.value as 'openai' | 'anthropic',
                            modelId: e.target.value === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022',
                          })
                        }
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                      </select>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
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
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCreateConversation} disabled={!newConversationTitle.trim()}>
                      Create
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowNewConversation(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {projectData.conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No conversations yet. Create one to start chatting!
                </p>
              ) : (
                <div className="grid gap-2">
                  {projectData.conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onSelectConversation(conversation.id)}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <div className="flex-1">
                          <h3 className="font-medium">{conversation.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {conversation.model_provider} · {conversation.model_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a project to view conversations</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
