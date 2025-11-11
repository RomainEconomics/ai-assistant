import {
  MessageSquare,
  FolderOpen,
  Settings,
  Plus,
  Home,
  FileText,
  Diff,
  List,
  Bot,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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
  const { t } = useTranslation();
  const { data: projects } = useProjects();
  const { logout, user } = useAuth();

  const handleHomeClick = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleDocumentsClick = () => {
    window.history.pushState({}, "", "/documents");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleMultiDocChatClick = () => {
    window.history.pushState({}, "", "/multi-doc-chat");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleBatchQuestioningClick = () => {
    window.history.pushState({}, "", "/batch-questioning");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleDeepAgentClick = () => {
    window.history.pushState({}, "", "/deepagent");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const isDocumentsActive = window.location.pathname === "/documents";
  const isMultiDocChatActive = window.location.pathname === "/multi-doc-chat";
  const isBatchQuestioningActive =
    window.location.pathname === "/batch-questioning";
  const isDeepAgentActive = window.location.pathname === "/deepagent";
  const isSettingsActive = window.location.pathname === "/settings";

  const handleSettingsClick = () => {
    window.history.pushState({}, "", "/settings");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleLogout = async () => {
    if (confirm(t("auth.logoutConfirm"))) {
      try {
        await logout();
        toast.success(t("auth.logout"));
      } catch (error) {
        toast.error("Logout failed");
      }
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <MessageSquare className="h-6 w-6" />
          <h2 className="font-semibold text-lg">ESG AI Assistant</h2>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleHomeClick}
                  isActive={
                    !selectedProjectId &&
                    !isDocumentsActive &&
                    !isMultiDocChatActive &&
                    !isBatchQuestioningActive
                  }
                >
                  <Home className="h-4 w-4" />
                  <span>{t("sidebar.allProjects")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleDocumentsClick}
                  isActive={isDocumentsActive}
                >
                  <FileText className="h-4 w-4" />
                  <span>{t("documents.title")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleMultiDocChatClick}
                  isActive={isMultiDocChatActive}
                >
                  <Diff className="h-4 w-4" />
                  <span>Multi-Doc Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleBatchQuestioningClick}
                  isActive={isBatchQuestioningActive}
                >
                  <List className="h-4 w-4" />
                  <span>{t("batchQuestioning.title")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleDeepAgentClick}
                  isActive={isDeepAgentActive}
                >
                  <Bot className="h-4 w-4" />
                  <span>{t("deepAgent.title")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.projects")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <Button onClick={onNewProject} className="w-full mb-2" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("sidebar.newProject")}
            </Button>

            <SidebarMenu>
              {projects && projects.length > 0 ? (
                projects.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      onClick={() => onSelectProject(project.id)}
                      isActive={selectedProjectId === project.id}
                    >
                      <FolderOpen className="h-4 w-4" />
                      <span>{project.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  {t("projects.emptyState")}
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSettingsClick}
              isActive={isSettingsActive}
            >
              <Settings className="h-4 w-4" />
              <span>{t("settings.title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>{t("auth.logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {user && (
          <div className="px-2 py-1 text-xs text-muted-foreground truncate">
            {user.username || user.email}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
