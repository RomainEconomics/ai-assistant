import { useState, useEffect, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ConversationPage } from "@/pages/ConversationPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { MultiDocChatPage } from "@/pages/MultiDocChatPage";
import { BatchQuestioningPage } from "@/pages/BatchQuestioningPage";
import { DeepAgentPage } from "@/pages/DeepAgentPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { LoginPage } from "@/pages/LoginPage";
import { DisclaimerDialog } from "@/components/DisclaimerDialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Toaster, toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useSettings, useUpdateSettings } from "@/hooks/useApi";
import "./lib/i18n"; // Initialize i18n
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Parse URL to determine current route
function parseRoute() {
  const path = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  // Match /conversations/:id
  const conversationMatch = path.match(/^\/conversations\/(\d+)$/);
  if (conversationMatch) {
    return {
      view: "conversation" as const,
      conversationId: parseInt(conversationMatch[1], 10),
    };
  }

  // Match /documents
  if (path === "/documents") {
    return {
      view: "documents" as const,
    };
  }

  // Match /multi-doc-chat
  if (path === "/multi-doc-chat") {
    return {
      view: "multi-doc-chat" as const,
    };
  }

  // Match /batch-questioning
  if (path === "/batch-questioning") {
    return {
      view: "batch-questioning" as const,
    };
  }

  // Match /deepagent
  if (path === "/deepagent") {
    return {
      view: "deepagent" as const,
    };
  }

  // Match /settings
  if (path === "/settings") {
    return {
      view: "settings" as const,
    };
  }

  // Match /projects/:id or query param ?project=:id
  const projectMatch = path.match(/^\/projects\/(\d+)$/);
  const projectIdParam = searchParams.get("project");
  const newProjectParam = searchParams.get("new");

  if (projectMatch) {
    return {
      view: "projects" as const,
      projectId: parseInt(projectMatch[1], 10),
    };
  }

  if (projectIdParam) {
    return {
      view: "projects" as const,
      projectId: parseInt(projectIdParam, 10),
    };
  }

  if (newProjectParam === "true") {
    return {
      view: "projects" as const,
      showNewProjectForm: true,
    };
  }

  // Default: home/projects list
  return { view: "projects" as const };
}

// Inner app component that uses auth (must be inside QueryClientProvider)
function AuthenticatedApp() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const { data: settings, isLoading: isLoadingSettings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [route, setRoute] = useState(parseRoute());

  // Check if disclaimer needs to be shown
  const showDisclaimer =
    isAuthenticated &&
    !isLoadingSettings &&
    settings &&
    !settings.disclaimer_accepted_at;

  const handleAcceptDisclaimer = async () => {
    try {
      await updateSettings.mutateAsync({
        disclaimer_accepted_at: new Date().toISOString(),
      });
      toast.success(t("disclaimer.acceptSuccess"));
    } catch (error) {
      console.error("Failed to accept disclaimer:", error);
      toast.error(t("disclaimer.acceptError"));
    }
  };

  // Listen to browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update document title based on current view
  useEffect(() => {
    const titles: Record<string, string> = {
      projects: t("projects.title"),
      conversation: t("conversation.title"),
      documents: t("documents.title"),
      "multi-doc-chat": "Multi-Doc Chat",
      "batch-questioning": t("batchQuestioning.title"),
      deepagent: t("deepAgent.title"),
      settings: t("settings.title"),
    };

    const title = titles[route.view] || t("projects.title");
    document.title = `${title} - ESG AI Assistant`;
  }, [route.view, t]);

  const navigate = (path: string, replace = false) => {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    setRoute(parseRoute());
  };

  const handleSelectProject = (projectId: number) => {
    navigate(`/projects/${projectId}`);
  };

  const handleSelectConversation = (conversationId: number) => {
    navigate(`/conversations/${conversationId}`);
  };

  const handleBackToProjects = () => {
    // Go back to the project if we have a projectId, otherwise home
    if (route.view === "conversation") {
      // We could track which project the conversation belongs to
      // For now, just go back in history
      window.history.back();
    } else {
      navigate("/");
    }
  };

  const handleNewProject = () => {
    navigate("/?new=true");
  };

  const handleCloseNewProjectForm = () => {
    navigate("/");
  };

  const currentView = route.view;
  const selectedProjectId =
    route.view === "projects" ? route.projectId || null : null;
  const selectedConversationId =
    route.view === "conversation" ? route.conversationId : null;
  const showNewProjectForm =
    route.view === "projects" && route.showNewProjectForm === true;

  const getPageTitle = () => {
    switch (currentView) {
      case "conversation":
        return t("conversations.title");
      case "documents":
        return t("documents.title");
      case "multi-doc-chat":
        return "Multi-Document Chat"; // TODO: Add translation
      case "batch-questioning":
        return t("batchQuestioning.title");
      case "settings":
        return t("settings.title");
      case "projects":
      default:
        return t("projects.title");
    }
  };

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Show loading state while checking authentication */}
      {isLoading && (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div
              className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"
              role="status"
            >
              <span className="sr-only">{t("common.loading")}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          </div>
        </div>
      )}

      {/* Show login page if not authenticated */}
      {!isLoading && !isAuthenticated && <LoginPage />}

      {/* Show main app if authenticated */}
      {!isLoading && isAuthenticated && (
        <SidebarProvider>
          <AppSidebar
            selectedProjectId={selectedProjectId}
            onSelectProject={handleSelectProject}
            onNewProject={handleNewProject}
          />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <div className="flex flex-1 items-center justify-between gap-2">
                <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
                <div className="flex items-center gap-2">
                  <ThemeSwitcher />
                  <LanguageSwitcher />
                </div>
              </div>
            </header>
            <div className="flex flex-1 flex-col">
              {currentView === "projects" && (
                <ProjectsPage
                  selectedProjectId={selectedProjectId}
                  onSelectProject={handleSelectProject}
                  onSelectConversation={handleSelectConversation}
                  showNewProjectForm={showNewProjectForm}
                  onCloseNewProjectForm={handleCloseNewProjectForm}
                />
              )}
              {currentView === "conversation" && selectedConversationId && (
                <ConversationPage
                  conversationId={selectedConversationId}
                  onBack={handleBackToProjects}
                />
              )}
              {currentView === "documents" && <DocumentsPage />}
              {currentView === "multi-doc-chat" && <MultiDocChatPage />}
              {currentView === "batch-questioning" && <BatchQuestioningPage />}
              {currentView === "deepagent" && <DeepAgentPage />}
              {currentView === "settings" && <SettingsPage />}
            </div>
          </SidebarInset>
        </SidebarProvider>
      )}

      {/* Disclaimer Dialog - shown after authentication if not yet accepted */}
      {showDisclaimer && (
        <DisclaimerDialog
          open={showDisclaimer}
          onAccept={handleAcceptDisclaimer}
        />
      )}

      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}

// Main App component with providers
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp />
    </QueryClientProvider>
  );
}

export default App;
