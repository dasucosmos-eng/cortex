import { NextRequest, NextResponse } from "next/server";
import { getOrchestrator } from "@/lib/ai/agent-orchestrator";

// GET /api/agents/[id] — Get specific execution details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orchestrator = getOrchestrator();
    const execution = orchestrator.getExecution(id);

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        taskId: execution.taskId,
        agentType: execution.agentType,
        status: execution.status,
        createdAt: execution.createdAt,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        result: execution.result,
      },
    });
  } catch (error) {
    console.error("[GET /api/agents/:id] Error:", error);
    return NextResponse.json(
      { error: "Failed to get execution" },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/[id] — Cancel a running execution
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orchestrator = getOrchestrator();
    const cancelled = orchestrator.cancelExecution(id);

    if (!cancelled) {
      return NextResponse.json(
        { error: "Could not cancel execution — it may already be completed or not found" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: { taskId: id, status: "cancelled" },
    });
  } catch (error) {
    console.error("[DELETE /api/agents/:id] Error:", error);
    return NextResponse.json(
      { error: "Failed to cancel execution" },
      { status: 500 }
    );
  }
}
