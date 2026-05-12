import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/projects — List all projects with session/memory counts
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sessions: {
          select: {
            id: true,
            memories: { select: { id: true } },
          },
        },
      },
    });

    const projectsWithCounts = projects.map((project) => {
      const sessionCount = project.sessions.length;
      const memoryCount = project.sessions.reduce(
        (acc, session) => acc + session.memories.length,
        0
      );

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
        isActive: project.isActive,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        sessionCount,
        memoryCount,
      };
    });

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
    const body = await request.json();
    const { name, description, color, icon } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Check for duplicate project name
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
