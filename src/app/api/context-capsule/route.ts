import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";

// GET /api/context-capsule — Generate the current context capsule
export async function GET() {
  try {
    const request = new NextRequest("https://internal");
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

    // ── Get active session ──
    const activeSessionSnapshot = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    let activeSession: Record<string, unknown> | null = null;
    if (!activeSessionSnapshot.empty) {
      const doc = activeSessionSnapshot.docs[0];
      activeSession = { id: doc.id, ...doc.data() };
    }

    // ── Get recent memories (last 10, exclude sensitive) ──
    const recentMemoriesSnapshot = await adminDb
      .collection("memories")
      .where("userId", "==", userId)
      .where("isSensitive", "==", false)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const recentMemories = recentMemoriesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        title: data.title || null,
        summary: data.summary || null,
        content: data.content || null,
        url: data.url || null,
        domain: data.domain || null,
        projectId: data.projectId || null,
        createdAt: data.createdAt,
      };
    });

    // ── Get today's timeline events ──
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
    const startOfDayISO = startOfDay.toISOString();
    const endOfDayISO = endOfDay.toISOString();

    // Firestore doesn't support range queries on unordered fields without indexes,
    // so we fetch recent timeline events and filter in JS
    const timelineSnapshot = await adminDb
      .collection("timeline")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const todaysTimeline = timelineSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          title: data.title,
          domain: data.domain || null,
          createdAt: data.createdAt,
        };
      })
      .filter((event) => {
        const created = event.createdAt as string;
        return created >= startOfDayISO && created < endOfDayISO;
      })
      .slice(0, 20);

    // ── Get project info for current session ──
    let currentProject: Record<string, unknown> | null = null;
    if (activeSession && activeSession.project) {
      const projectSnapshot = await adminDb
        .collection("projects")
        .where("userId", "==", userId)
        .where("name", "==", String(activeSession.project))
        .limit(1)
        .get();

      if (!projectSnapshot.empty) {
        const doc = projectSnapshot.docs[0];
        const data = doc.data();
        currentProject = {
          id: doc.id,
          name: data.name,
          description: data.description || null,
          color: data.color || "#6366f1",
        };
      }
    }

    // ── Get session memory count for context ──
    let sessionMemoryCount = 0;
    if (activeSession) {
      const sessionMemoriesSnapshot = await adminDb
        .collection("memories")
        .where("userId", "==", userId)
        .where("sessionId", "==", String(activeSession.id))
        .select("__name__")
        .get();
      sessionMemoryCount = sessionMemoriesSnapshot.size;
    }

    // ── Format the context capsule ──
    const contextCapsule = {
      timestamp: new Date().toISOString(),
      currentSession: activeSession
        ? {
            id: activeSession.id,
            title: activeSession.title,
            task: activeSession.task || null,
            intent: activeSession.intent || null,
            project: activeSession.project || null,
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
        summary: memory.summary || (memory.content ? memory.content.substring(0, 150) : ""),
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
        projectName:
          (currentProject?.name as string) ||
          (activeSession?.project as string) ||
          null,
        recentMemoryCount: recentMemories.length,
        todayEventCount: todaysTimeline.length,
        hasSensitiveData: false,
      },
    };

    // ── Generate a readable AI context string ──
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
        (m) =>
          `  - [${m.type}] ${m.title || "Untitled"}: ${m.summary.substring(0, 100)}`
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
