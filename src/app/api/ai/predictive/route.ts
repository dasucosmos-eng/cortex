import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";

// GET /api/ai/predictive — Get AI predictions and suggestions
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const [
      recentMemoriesSnap,
      recentSessionsSnap,
      knowledgeNodesSnap,
      agentExecutionsSnap,
      timelineEventsSnap,
    ] = await Promise.all([
      adminDb
        .collection("memories")
        .where("userId", "==", userId)
        .where("isSensitive", "==", false)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get(),
      adminDb
        .collection("sessions")
        .where("userId", "==", userId)
        .where("isActive", "==", false)
        .orderBy("endedAt", "desc")
        .limit(20)
        .get(),
      adminDb
        .collection("knowledgeNodes")
        .where("userId", "==", userId)
        .orderBy("importance", "desc")
        .limit(30)
        .get(),
      adminDb
        .collection("agentExecutions")
        .where("userId", "==", userId)
        .where("status", "==", "failed")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get(),
      adminDb
        .collection("timeline")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(30)
        .get(),
    ]);

    const recentMemories = recentMemoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const recentSessions = recentSessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const knowledgeNodes = knowledgeNodesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const agentExecutions = agentExecutionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const timelineEvents = timelineEventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Suggested docs based on recent topics
    const topicCounts = new Map<string, number>();
    for (const mem of recentMemories as Array<Record<string, any>>) {
      const topics: string[] = [];
      try { topics.push(...(mem.tags ? JSON.parse(mem.tags) : [])); } catch { }
      if (mem.type === "research" && mem.title) topics.push(mem.title);
      for (const t of topics) topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
    }

    const suggestedDocs = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([topic, count]) => ({ topic, relevance: count, suggestion: `Review documentation related to "${topic}" based on ${count} recent references` }));

    // Unfinished work
    const unfinishedWork = recentSessions
      .filter((s: any) => {
        if (!s.endedAt || !s.startedAt) return false;
        const duration = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
        return duration < 5 * 60 * 1000 && s.task;
      })
      .slice(0, 5)
      .map((s: any) => ({
        sessionId: s.id, title: s.title, task: s.task, project: s.project, intent: s.intent,
        suggestion: `Resume work on "${s.task || s.title}" from project "${s.project || "unknown"}"`,
      }));

    // Error patterns
    const errorPatterns = new Map<string, number>();
    for (const exec of agentExecutions as Array<Record<string, any>>) {
      if (exec.error) {
        const errorSnippet = exec.error.substring(0, 100);
        errorPatterns.set(errorSnippet, (errorPatterns.get(errorSnippet) || 0) + 1);
      }
    }

    const repeatedErrors = Array.from(errorPatterns.entries())
      .filter(([, count]) => count > 1)
      .map(([error, count]) => ({ error, occurrences: count, suggestion: `This error has occurred ${count} times recently.` }));

    const preloadedReferences = knowledgeNodes.slice(0, 10).map((node: any) => ({
      id: node.id, type: node.type, label: node.label, importance: node.importance,
      reason: `High-importance ${node.type} node frequently referenced in your knowledge graph`,
    }));

    const domainCounts = new Map<string, number>();
    for (const event of timelineEvents as Array<Record<string, any>>) {
      if (event.domain) domainCounts.set(event.domain, (domainCounts.get(event.domain) || 0) + 1);
    }

    const topDomains = Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const architectureSuggestions = topDomains.map(([domain, count]) => ({
      domain, activity: count,
      suggestion: `High activity on ${domain} (${count} events). Consider organizing related memories into a dedicated project.`,
    }));

    return NextResponse.json({
      data: {
        suggestedDocs, unfinishedWork, repeatedErrors, preloadedReferences, architectureSuggestions,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[GET /api/ai/predictive] Error:", error);
    return NextResponse.json({ error: "Failed to generate AI predictions" }, { status: 500 });
  }
}
