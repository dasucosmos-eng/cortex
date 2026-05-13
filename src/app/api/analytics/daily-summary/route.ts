import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";

// GET /api/analytics/daily-summary — Get daily summaries with rich analytics and trends
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Fetch all daily summaries for the user and filter in JS
    const snapshot = await adminDb
      .collection("aiDailySummaries")
      .where("userId", "==", userId)
      .orderBy("date", "desc")
      .get();

    let summaries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Apply date range filter
    if (startDate) {
      summaries = summaries.filter((s: any) => s.date >= startDate);
    }
    if (endDate) {
      summaries = summaries.filter((s: any) => s.date <= endDate);
    }

    const enrichedSummaries = summaries.map((summary: any) => {
      let topics: string[] = [];
      let projects: Array<Record<string, unknown>> = [];
      let stats: Record<string, unknown> = {};

      try { topics = summary.topics ? JSON.parse(summary.topics) : []; } catch { topics = []; }
      try { projects = summary.projects ? JSON.parse(summary.projects) : []; } catch { projects = []; }
      try { stats = summary.stats ? JSON.parse(summary.stats) : {}; } catch { stats = {}; }

      return { ...summary, topics, projects, stats };
    });

    // Calculate weekly trends
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    const currentWeekStartStr = currentWeekStart.toISOString().split("T")[0];
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekStartStr = previousWeekStart.toISOString().split("T")[0];
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
    const currentWeekEndStr = currentWeekEnd.toISOString().split("T")[0];
    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() + 6);

    function aggregateWeekStats(weekSummaries: any[]) {
      let totalSessions = 0, totalMemories = 0, totalDecisions = 0;
      const allTopics: string[] = [];
      const allProjects: Set<string> = new Set();

      for (const s of weekSummaries) {
        try { const st = s.stats ? (typeof s.stats === "string" ? JSON.parse(s.stats) : s.stats) : {}; totalSessions += st.sessionsCreated || 0; totalMemories += st.memoriesCreated || 0; totalDecisions += st.decisionsMade || 0; } catch { }
        try { const t = s.topics ? (typeof s.topics === "string" ? JSON.parse(s.topics) : s.topics) : []; allTopics.push(...t); } catch { }
        try { const p = s.projects ? (typeof s.projects === "string" ? JSON.parse(s.projects) : s.projects) : []; for (const pr of p) { if (pr.name) allProjects.add(String(pr.name)); } } catch { }
      }

      const topicCounts = new Map<string, number>();
      for (const t of allTopics) topicCounts.set(t, (topicCounts.get(t) || 0) + 1);

      return {
        daysActive: weekSummaries.length, totalSessions, totalMemories, totalDecisions,
        uniqueTopics: topicCounts.size,
        topTopics: Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic, count]) => ({ topic, count })),
        uniqueProjects: allProjects.size,
      };
    }

    // Filter summaries by week ranges for trend calculation
    const previousWeekEndStr = previousWeekEnd.toISOString().split("T")[0];

    const currentWeekSummaries = summaries.filter((s: any) => s.date >= currentWeekStartStr && s.date <= currentWeekEndStr);
    const previousWeekSummaries = summaries.filter((s: any) => s.date >= previousWeekStartStr && s.date <= previousWeekEndStr);

    const currentStats = aggregateWeekStats(currentWeekSummaries);
    const previousStats = aggregateWeekStats(previousWeekSummaries);

    function computeChange(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    }

    const trends = {
      currentWeek: { startDate: currentWeekStartStr, endDate: currentWeekEndStr, ...currentStats },
      previousWeek: { startDate: previousWeekStartStr, endDate: previousWeekEndStr, ...previousStats },
      changes: {
        sessions: computeChange(currentStats.totalSessions, previousStats.totalSessions),
        memories: computeChange(currentStats.totalMemories, previousStats.totalMemories),
        decisions: computeChange(currentStats.totalDecisions, previousStats.totalDecisions),
        activeDays: computeChange(currentStats.daysActive, previousStats.daysActive),
      },
    };

    return NextResponse.json({ data: enrichedSummaries, trends });
  } catch (error) {
    console.error("[GET /api/analytics/daily-summary] Error:", error);
    return NextResponse.json({ error: "Failed to fetch daily summaries" }, { status: 500 });
  }
}
