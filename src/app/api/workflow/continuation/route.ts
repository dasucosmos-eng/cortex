import { NextRequest, NextResponse } from "next/server";
import {
  scanAndSuggest,
  resumeWorkflow,
  createWorkflowSnapshot,
  detectInterruption,
} from "@/lib/ai/workflow-continuation";
import { auth } from "@/lib/auth";

// GET /api/workflow/continuation — Get continuation suggestions
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const interrupted = await detectInterruption(userId);

    if (interrupted.length === 0) {
      return NextResponse.json({
        data: {
          interruptedSessions: [],
          suggestions: [],
          message: "No interrupted workflows detected. All sessions are active.",
        },
      });
    }

    const suggestions = [];
    for (const sessionItem of interrupted.slice(0, 5)) {
      const snapshot = await createWorkflowSnapshot(sessionItem.sessionId);
      if (snapshot) {
        suggestions.push({
          sessionId: sessionItem.sessionId,
          type: snapshot.type,
          title: snapshot.title,
          tabsCount: snapshot.tabs.length,
          memoriesCount: snapshot.memories.length,
          lastActivityAt: sessionItem.lastActivityAt,
          timeSinceInterruption: Date.now() - sessionItem.lastActivityAt.getTime(),
        });
      }
    }

    return NextResponse.json({
      data: {
        interruptedSessions: interrupted.map((s) => ({
          sessionId: s.sessionId,
          lastActivityAt: s.lastActivityAt,
          eventCount: s.eventCount,
          memoryCount: s.memoryCount,
        })),
        suggestions,
      },
    });
  } catch (error) {
    console.error("[GET /api/workflow/continuation] Error:", error);
    return NextResponse.json({ error: "Failed to detect workflow continuations" }, { status: 500 });
  }
}

// POST /api/workflow/continuation — Resume a workflow
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { snapshotId, sessionId } = body;

    const id = snapshotId || sessionId;
    if (!id) {
      return NextResponse.json({ error: "snapshotId or sessionId is required" }, { status: 400 });
    }

    const result = await resumeWorkflow(id);

    if (!result) {
      return NextResponse.json(
        { error: "Could not create continuation plan for the given session" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        sessionId: result.originalWork.sessionId,
        workflowType: result.originalWork.type,
        title: result.originalWork.title,
        timeElapsed: result.timeElapsed,
        completenessScore: result.completenessScore,
        suggestedNextSteps: result.suggestedNextSteps,
        relatedRecentWork: result.relatedRecentWork,
        contextCapsule: result.contextCapsule,
        tabsToRestore: result.originalWork.tabs.slice(0, 10).map((t) => ({
          url: t.url,
          title: t.title,
          domain: t.domain,
        })),
      },
    });
  } catch (error) {
    console.error("[POST /api/workflow/continuation] Error:", error);
    return NextResponse.json({ error: "Failed to resume workflow" }, { status: 500 });
  }
}
