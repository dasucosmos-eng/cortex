import { NextRequest, NextResponse } from "next/server";
import {
  scanAndSuggest,
  resumeWorkflow,
  createWorkflowSnapshot,
  detectInterruption,
} from "@/lib/ai/workflow-continuation";

// GET /api/workflow/continuation — Get continuation suggestions
export async function GET() {
  try {
    // Check for interrupted workflows
    const interrupted = await detectInterruption();

    if (interrupted.length === 0) {
      return NextResponse.json({
        data: {
          interruptedSessions: [],
          suggestions: [],
          message: "No interrupted workflows detected. All sessions are active.",
        },
      });
    }

    // Create snapshots and generate continuation suggestions
    const suggestions = [];
    for (const session of interrupted.slice(0, 5)) {
      const snapshot = await createWorkflowSnapshot(session.sessionId);
      if (snapshot) {
        suggestions.push({
          sessionId: session.sessionId,
          type: snapshot.type,
          title: snapshot.title,
          tabsCount: snapshot.tabs.length,
          memoriesCount: snapshot.memories.length,
          lastActivityAt: session.lastActivityAt,
          timeSinceInterruption: Date.now() - session.lastActivityAt.getTime(),
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
    return NextResponse.json(
      { error: "Failed to detect workflow continuations" },
      { status: 500 }
    );
  }
}

// POST /api/workflow/continuation — Resume a workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshotId, sessionId } = body;

    const id = snapshotId || sessionId;
    if (!id) {
      return NextResponse.json(
        { error: "snapshotId or sessionId is required" },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: "Failed to resume workflow" },
      { status: 500 }
    );
  }
}
