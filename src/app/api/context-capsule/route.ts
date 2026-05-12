import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/context-capsule — Generate the current context capsule
export async function GET() {
  try {
    // Get active session
    const activeSession = await db.session.findFirst({
      where: { isActive: true },
    });

    // Get recent memories (last 10, exclude sensitive)
    const recentMemories = await db.memory.findMany({
      where: {
        isSensitive: false,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        summary: true,
        content: true,
        url: true,
        domain: true,
        projectId: true,
        createdAt: true,
      },
    });

    // Get today's timeline events
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    );

    const todaysTimeline = await db.timelineEvent.findMany({
      where: {
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        domain: true,
        createdAt: true,
      },
    });

    // Get project info for current session
    let currentProject = null;
    if (activeSession?.project) {
      currentProject = await db.project.findFirst({
        where: { name: activeSession.project },
      });
    }

    // Get session memory count for context
    let sessionMemoryCount = 0;
    if (activeSession) {
      sessionMemoryCount = await db.memory.count({
        where: { sessionId: activeSession.id },
      });
    }

    // Format the context capsule
    const contextCapsule = {
      timestamp: new Date().toISOString(),
      currentSession: activeSession
        ? {
            id: activeSession.id,
            title: activeSession.title,
            task: activeSession.task,
            intent: activeSession.intent,
            project: activeSession.project,
            startedAt: activeSession.startedAt,
            memoryCount: sessionMemoryCount,
          }
        : null,
      currentProject: currentProject
        ? {
            id: currentProject.id,
            name: currentProject.name,
            description: currentProject.description,
            color: currentProject.color,
          }
        : null,
      recentMemories: recentMemories.map((memory) => ({
        id: memory.id,
        type: memory.type,
        title: memory.title,
        summary: memory.summary || memory.content.substring(0, 150),
        url: memory.url,
        domain: memory.domain,
        projectId: memory.projectId,
        createdAt: memory.createdAt,
      })),
      todaysTimeline: todaysTimeline.map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        domain: event.domain,
        createdAt: event.createdAt,
      })),
      summary: {
        activeSessionTitle: activeSession?.title || null,
        projectName: currentProject?.name || activeSession?.project || null,
        recentMemoryCount: recentMemories.length,
        todayEventCount: todaysTimeline.length,
        hasSensitiveData: false, // Already filtered out
      },
    };

    // Generate a readable AI context string
    const readableContext = [
      "=== CURRENT CONTEXT CAPSULE ===",
      "",
      `Timestamp: ${contextCapsule.timestamp}`,
      "",
      contextCapsule.currentSession
        ? `Active Session: "${contextCapsule.currentSession.title}"`
        : "No active session",
      contextCapsule.currentSession?.task
        ? `  Task: ${contextCapsule.currentSession.task}`
        : "",
      contextCapsule.currentProject
        ? `  Project: ${contextCapsule.currentProject.name}`
        : "",
      contextCapsule.currentSession?.intent
        ? `  Intent: ${contextCapsule.currentSession.intent}`
        : "",
      "",
      `Recent Memories (${contextCapsule.recentMemories.length}):`,
      ...contextCapsule.recentMemories.map(
        (m) => `  - [${m.type}] ${m.title || "Untitled"}: ${m.summary.substring(0, 100)}`
      ),
      "",
      `Today's Timeline (${contextCapsule.todaysTimeline.length} events):`,
      ...contextCapsule.todaysTimeline.map(
        (e) => `  - [${e.type}] ${e.title}`
      ),
      "",
      "=== END CONTEXT CAPSULE ===",
    ]
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({
      data: contextCapsule,
      readableContext,
    });
  } catch (error) {
    console.error("[GET /api/context-capsule] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate context capsule" },
      { status: 500 }
    );
  }
}
