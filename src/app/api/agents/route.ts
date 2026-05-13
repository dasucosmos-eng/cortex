import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";
import { getOrchestrator } from "@/lib/ai/agent-orchestrator";
import type { AgentType } from "@/lib/ai/agent-orchestrator";

// GET /api/agents — List available agents with configs and recent stats
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orchestrator = getOrchestrator();
    const configs = orchestrator.getConfigs();
    const stats = orchestrator.getStats();
    const queueStatus = orchestrator.getQueueStatus();

    const agents = Object.entries(configs).map(([type, config]) => ({
      type: config.type,
      name: config.name,
      description: config.description,
      capabilities: config.capabilities,
      model: config.model,
      stats: stats[type as AgentType],
    }));

    return NextResponse.json({ data: { agents, queueStatus } });
  } catch (error) {
    console.error("[GET /api/agents] Error:", error);
    return NextResponse.json({ error: "Failed to list agents" }, { status: 500 });
  }
}

// POST /api/agents — Execute an agent task
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const body = await request.json();
    const { agentType, input, context, priority } = body;

    if (!agentType || !input) {
      return NextResponse.json({ error: "agentType and input are required" }, { status: 400 });
    }

    const orchestrator = getOrchestrator();
    const config = orchestrator.getConfig(agentType as AgentType);

    if (!config) {
      return NextResponse.json({ error: `Unknown agent type: ${agentType}` }, { status: 400 });
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const task = {
      id: taskId,
      agentType: agentType as AgentType,
      input: typeof input === "string" ? { query: input } : input,
      context: context || { relevantMemories: [], knowledgeGraph: {} },
      priority: priority || "medium",
      createdAt: new Date(),
    };

    const result = await orchestrator.execute(task);

    // Log execution to Firestore
    const executionId = generateId();
    await adminDb.collection("agentExecutions").doc(executionId).set({
      agentType: agentType as AgentType,
      status: result.status,
      input: JSON.stringify(input),
      output: JSON.stringify(result.output),
      contextSize: result.tokensUsed || 0,
      duration: result.duration || 0,
      model: config.model,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      data: {
        taskId: result.taskId,
        agentType: result.agentType,
        status: result.status,
        output: result.output,
        confidence: result.confidence,
        tokensUsed: result.tokensUsed,
        duration: result.duration,
        followUpActions: result.followUpActions,
      },
    });
  } catch (error) {
    console.error("[POST /api/agents] Error:", error);
    return NextResponse.json({ error: "Agent execution failed" }, { status: 500 });
  }
}
