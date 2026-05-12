import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/projects — List all projects with session/memory counts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    const sessions = await db.session.findMany({
      where: { userId: session.user.id },
      select: { id: true, project: true },
    });

    const memories = await db.memory.findMany({
      where: { userId: session.user.id },
      select: { id: true, projectId: true },
    });

    // Build counts by matching project name to session.project string
    const sessionCounts: Record<string, number> = {};
    const memoryCounts: Record<string, number> = {};

    for (const sessionItem of sessions) {
      if (sessionItem.project) {
        sessionCounts[sessionItem.project] = (sessionCounts[sessionItem.project] || 0) + 1;
      }
    }

    for (const memory of memories) {
      if (memory.projectId) {
        const project = projects.find((p) => p.id === memory.projectId);
        if (project) {
          memoryCounts[project.name] = (memoryCounts[project.name] || 0) + 1;
        }
      }
    }

    const projectsWithCounts = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      icon: project.icon,
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      sessionCount: sessionCounts[project.name] || 0,
      memoryCount: memoryCounts[project.name] || 0,
    }));

    return NextResponse.json({ data: projectsWithCounts });
  } catch (error) {
    console.error("[GET /api/projects] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects — Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, color, icon } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const existing = await db.project.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A project with this name already exists" },
        { status: 409 }
      );
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description || null,
        color: color || "#6366f1",
        icon: icon || null,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects] Error:", error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A project with this name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
