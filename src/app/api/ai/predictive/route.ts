import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/ai/predictive — Get AI predictions and suggestions
export async function GET() {
  try {
    // Gather data from multiple sources to generate predictions
    const [
      recentMemories,
      recentSessions,
      knowledgeNodes,
      agentExecutions,
      timelineEvents,
    ] = await Promise.all([
      // Recent memories to understand current work
      db.memory.findMany({
        where: { isSensitive: false },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          tags: true,
          projectId: true,
          createdAt: true,
        },
      }),

      // Recent sessions to find unfinished work
      db.session.findMany({
        where: { isActive: false },
        orderBy: { endedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          project: true,
          task: true,
          intent: true,
          summary: true,
          startedAt: true,
          endedAt: true,
        },
      }),

      // Knowledge graph for architecture understanding
      db.knowledgeNode.findMany({
        orderBy: { importance: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          label: true,
          importance: true,
          metadata: true,
        },
      }),

      // Agent execution history for error patterns
      db.agentExecution.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          agentType: true,
          error: true,
          input: true,
          createdAt: true,
        },
      }),

      // Recent timeline events for activity patterns
      db.timelineEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          type: true,
          title: true,
          domain: true,
          createdAt: true,
        },
      }),
    ]);

    // 1. Suggested docs to read based on recent topics
    const topicCounts = new Map<string, number>();
    for (const mem of recentMemories) {
      const topics: string[] = [];
      try {
        topics.push(...(mem.tags ? JSON.parse(mem.tags) : []));
      } catch {
        // skip
      }
      if (mem.type === "research" && mem.title) {
        topics.push(mem.title);
      }
      for (const t of topics) {
        topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
      }
    }

    const suggestedDocs = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({
        topic,
        relevance: count,
        suggestion: `Review documentation related to "${topic}" based on ${count} recent references`,
      }));

    // 2. Unfinished work from active/interrupted sessions
    const unfinishedWork = recentSessions
      .filter((s) => {
        // Look for sessions that may have been interrupted
        if (!s.endedAt || !s.startedAt) return false;
        const duration = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
        // Very short sessions might be interrupted
        return duration < 5 * 60 * 1000 && s.task; // less than 5 minutes
      })
      .slice(0, 5)
      .map((s) => ({
        sessionId: s.id,
        title: s.title,
        task: s.task,
        project: s.project,
        intent: s.intent,
        suggestion: `Resume work on "${s.task || s.title}" from project "${s.project || "unknown"}"`,
      }));

    // 3. Repeated errors from agent execution history
    const errorPatterns = new Map<string, number>();
    for (const exec of agentExecutions) {
      if (exec.error) {
        const errorSnippet = exec.error.substring(0, 100);
        errorPatterns.set(errorSnippet, (errorPatterns.get(errorSnippet) || 0) + 1);
      }
    }

    const repeatedErrors = Array.from(errorPatterns.entries())
      .filter(([, count]) => count > 1)
      .map(([error, count]) => ({
        error,
        occurrences: count,
        suggestion: `This error has occurred ${count} times recently. Consider investigating and fixing the root cause.`,
      }));

    // 4. Preloaded references based on knowledge graph importance
    const preloadedReferences = knowledgeNodes.slice(0, 10).map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      importance: node.importance,
      reason: `High-importance ${node.type} node frequently referenced in your knowledge graph`,
    }));

    // 5. Architecture suggestions based on project patterns
    const projectCounts = new Map<string, number>();
    for (const mem of recentMemories) {
      if (mem.projectId) {
        projectCounts.set(mem.projectId, (projectCounts.get(mem.projectId) || 0) + 1);
      }
    }

    // Identify most active domains
    const domainCounts = new Map<string, number>();
    for (const event of timelineEvents) {
      if (event.domain) {
        domainCounts.set(event.domain, (domainCounts.get(event.domain) || 0) + 1);
      }
    }

    const topDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const architectureSuggestions = [
      ...topDomains.map(([domain, count]) => ({
        domain,
        activity: count,
        suggestion: `High activity on ${domain} (${count} events). Consider organizing related memories into a dedicated project.`,
      })),
    ];

    return NextResponse.json({
      data: {
        suggestedDocs,
        unfinishedWork,
        repeatedErrors,
        preloadedReferences,
        architectureSuggestions,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[GET /api/ai/predictive] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI predictions" },
      { status: 500 }
    );
  }
}
