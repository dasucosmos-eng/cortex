import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/analytics/daily-summary — Get daily summaries with rich analytics and trends
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: Record<string, unknown> = { userId: session.user.id };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = startDate;
      if (endDate) (where.date as Record<string, unknown>).lte = endDate;
    }

    const summaries = await db.aIDailySummary.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const enrichedSummaries = summaries.map((summary) => {
      let topics: string[] = [];
      let projects: Array<Record<string, unknown>> = [];
      let stats: Record<string, unknown> = {};

      try { topics = summary.topics ? JSON.parse(summary.topics) : []; } catch { topics = []; }
      try { projects = summary.projects ? JSON.parse(summary.projects) : []; } catch { projects = []; }
      try { stats = summary.stats ? JSON.parse(summary.stats) : {}; } catch { stats = {}; }

      return { ...summary, topics, projects, stats };
    });

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

    const [currentWeekSummaries, previousWeekSummaries] = await Promise.all([
      db.aIDailySummary.findMany({ where: { userId: session.user.id, date: { gte: currentWeekStartStr, lte: currentWeekEndStr } } }),
      db.aIDailySummary.findMany({ where: { userId: session.user.id, date: { gte: previousWeekStartStr, lte: previousWeekEnd.toISOString().split("T")[0] } } }),
    ]);

    function aggregateWeekStats(weekSummaries: typeof currentWeekSummaries) {
      let totalSessions = 0, totalMemories = 0, totalDecisions = 0;
      const allTopics: string[] = [];
      const allProjects: Set<string> = new Set();

      for (const s of weekSummaries) {
        try { const st = s.stats ? JSON.parse(s.stats) : {}; totalSessions += st.sessionsCreated || 0; totalMemories += st.memoriesCreated || 0; totalDecisions += st.decisionsMade || 0; } catch { }
        try { const t = s.topics ? JSON.parse(s.topics) : []; allTopics.push(...t); } catch { }
        try { const p = s.projects ? JSON.parse(s.projects) : []; for (const pr of p) { if (pr.name) allProjects.add(String(pr.name)); } } catch { }
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

    const currentStats = aggregateWeekStats(currentWeekSummaries);
    const previousStats = aggregateWeekStats(previousWeekSummaries);

    function computeChange(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    }

    const trends = {
      currentWeek: { startDate: currentWeekStartStr, endDate: currentWeekEndStr, ...currentStats },
      previousWeek: { startDate: previousWeekStartStr, endDate: previousWeekEnd.toISOString().split("T")[0], ...previousStats },
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
