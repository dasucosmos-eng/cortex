import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getOrchestrator } from "@/lib/ai/agent-orchestrator";

// GET /api/agents/executions — List recent agent executions
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status");

    const orchestrator = getOrchestrator();
    let executions = orchestrator.getRecentExecutions(limit);

    if (status) {
      executions = executions.filter((e) => e.status === status);
    }

    const formattedExecutions = executions.map((exec) => ({
      taskId: exec.taskId,
      agentType: exec.agentType,
      status: exec.status,
      createdAt: exec.createdAt,
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
      duration: exec.result?.duration || 0,
      confidence: exec.result?.confidence || 0,
      tokensUsed: exec.result?.tokensUsed || 0,
    }));

    return NextResponse.json({
      data: formattedExecutions,
      total: formattedExecutions.length,
    });
  } catch (error) {
    console.error("[GET /api/agents/executions] Error:", error);
    return NextResponse.json({ error: "Failed to list executions" }, { status: 500 });
  }
}
