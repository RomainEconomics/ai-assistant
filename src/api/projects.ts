import type { ServerRequest } from "bun";
import * as dbQueries from "@/lib/db";
import type { CreateProjectRequest, UpdateProjectRequest } from "@/types/api";
import { requireAuth } from "@/middleware/auth";
import { verifyProjectOwnership } from "@/middleware/ownership";

export async function handleGetProjects(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const projects = await dbQueries.getAllProjects(user.id);
    return Response.json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return Response.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function handleGetProject(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const project = await verifyProjectOwnership(id, user.id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const conversations = await dbQueries.getConversationsByProject(id);
    return Response.json({ project, conversations });
  } catch (error) {
    console.error("Error fetching project:", error);
    return Response.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function handleCreateProject(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const body = (await req.json()) as CreateProjectRequest;

    if (!body.name || body.name.trim() === "") {
      return Response.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await dbQueries.createProject(
      user.id,
      body.name.trim(),
      body.description?.trim() || null,
      body.is_private ?? true
    );

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return Response.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function handleUpdateProject(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid project ID" }, { status: 400 });
    }

    // Verify ownership before update
    const existingProject = await verifyProjectOwnership(id, user.id);
    if (!existingProject) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const body = (await req.json()) as UpdateProjectRequest;
    const project = await dbQueries.updateProject(id, body);

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    return Response.json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return Response.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function handleDeleteProject(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid project ID" }, { status: 400 });
    }

    // Verify ownership before deletion
    const project = await verifyProjectOwnership(id, user.id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    await dbQueries.deleteProject(id);
    return Response.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return Response.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
