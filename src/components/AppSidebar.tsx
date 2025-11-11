import { MessageSquare, FolderOpen, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useProjects } from "@/hooks/useApi";

interface AppSidebarProps {
  selectedProjectId: number | null;
  onSelectProject: (projectId: number) => void;
  onNewProject: () => void;
}

export function AppSidebar({
  selectedProjectId,
  onSelectProject,
  onNewProject,
}: AppSidebarProps) {
  const { data: projects } = useProjects();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/40">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <MessageSquare className="h-5 w-5 mr-2" />
        <h2 className="font-semibold">ESG AI Assistant</h2>
      </div>

      {/* New Project Button */}
      <div className="p-4">
        <Button onClick={onNewProject} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <Separator />

      {/* Projects List */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 py-2">
          <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Projects
          </h3>
          {projects && projects.length > 0 ? (
            projects.map((project) => (
              <Button
                key={project.id}
                variant={
                  selectedProjectId === project.id ? "secondary" : "ghost"
                }
                className="w-full justify-start font-normal"
                size="sm"
                onClick={() => onSelectProject(project.id)}
              >
                <FolderOpen className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{project.name}</span>
              </Button>
            ))
          ) : (
            <p className="px-2 text-sm text-muted-foreground">
              No projects yet
            </p>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Footer */}
      <div className="p-3">
        <Button variant="ghost" className="w-full justify-start" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>
    </div>
  );
}
