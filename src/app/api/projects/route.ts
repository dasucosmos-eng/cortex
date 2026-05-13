import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

// GET /api/projects — List all projects with session/memory counts
export async function GET() {
  try {
    const request = new NextRequest("https://internal");
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

    // Fetch all projects for this user
    const projectsSnapshot = await adminDb
      .collection("projects")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const projects: Array<Record<string, any>> = projectsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, any>),
    }));

    // Fetch sessions and memories for this user to compute counts
    // Sessions are linked to projects by `project` field (project name string)
    const sessionsSnapshot = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .select("project")
      .get();

    const memoriesSnapshot = await adminDb
      .collection("memories")
      .where("userId", "==", userId)
      .select("projectId")
      .get();

    // Build counts by matching project name (sessions) and projectId (memories)
    const sessionCounts: Record<string, number> = {};
    const memoryCounts: Record<string, number> = {};

    for (const doc of sessionsSnapshot.docs) {
      const project = doc.get("project");
      if (project) {
        sessionCounts[project] = (sessionCounts[project] || 0) + 1;
      }
    }

    // Build a map of project id -> name for memory counting
    const projectIdToName: Record<string, string> = {};
    for (const project of projects) {
      projectIdToName[project.id] = project.name;
    }

    for (const doc of memoriesSnapshot.docs) {
      const projectId = doc.get("projectId");
      if (projectId && projectIdToName[projectId]) {
        const name = projectIdToName[projectId];
        memoryCounts[name] = (memoryCounts[name] || 0) + 1;
      }
    }

    const projectsWithCounts = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description || null,
      color: project.color || "#6366f1",
      icon: project.icon || null,
      isActive: project.isActive ?? true,
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

// POST /api/projects — Create a new project (check uniqueness per-user)
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

    const body = await request.json();
    const { name, description, color, icon } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Check for existing project with same name for THIS user (not global)
    // Firestore doesn't enforce uniqueness, so we check per-user
    const existingSnapshot = await adminDb
      .collection("projects")
      .where("userId", "==", userId)
      .where("name", "==", trimmedName)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return NextResponse.json(
        { error: "A project with this name already exists" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const projectId = generateId();

    const projectDoc = {
      userId,
      name: trimmedName,
      description: description || null,
      color: color || "#6366f1",
      icon: icon || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("projects").doc(projectId).set(projectDoc);

    return NextResponse.json(
      { data: { id: projectId, ...projectDoc } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/projects] Error:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
