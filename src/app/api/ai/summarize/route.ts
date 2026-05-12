import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import ZAI from "z-ai-web-dev-sdk";

// POST /api/ai/summarize — Generate AI summaries
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, id } = body;

    if (!type || !["session", "daily", "project"].includes(type)) {
      return NextResponse.json({ error: "Type must be one of: session, daily, project" }, { status: 400 });
    }

    const userId = session.user.id;
    const zai = await ZAI.create();
    let summaryText = "";
    let topics: string[] = [];

    if (type === "session") {
      if (!id) {
        return NextResponse.json({ error: "Session ID is required for session summaries" }, { status: 400 });
      }

      const sessionData = await db.session.findUnique({
        where: { id },
        include: {
          memories: { orderBy: { createdAt: "asc" }, take: 50 },
          timeline: { orderBy: { createdAt: "asc" }, take: 50 },
        },
      });

      if (!sessionData || sessionData.userId !== userId) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const memoryList = sessionData.memories.map((m) => `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content).substring(0, 300)}`).join("\n");
      const timelineList = sessionData.timeline.map((e) => `[${e.type}] ${e.title}`).join("\n");

      const systemPrompt = "You are an AI assistant that summarizes browser sessions. Provide a concise summary. Respond in JSON: ```json\n{\"summary\": \"...\", \"topics\": [\"topic1\"]}\n```";
      const userMessage = `Summarize this session titled "${sessionData.title}":\n${sessionData.task ? `Task: ${sessionData.task}` : ""}\nMemories:\n${memoryList || "No memories."}\nTimeline:\n${timelineList || "No timeline events."}`;

      const completion = await zai.chat.completions.create({
        messages: [{ role: "assistant", content: systemPrompt }, { role: "user", content: userMessage }],
      });

      const aiContent = completion.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const parsed = JSON.parse((jsonMatch ? jsonMatch[1] : aiContent).trim());
        summaryText = parsed.summary || aiContent;
        topics = parsed.topics || [];
      } catch { summaryText = aiContent; }

      await db.session.update({ where: { id }, data: { summary: summaryText } });

      return NextResponse.json({ data: { type: "session", id, summary: summaryText, topics } });
    }

    if (type === "daily") {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const dateStr = today.toISOString().split("T")[0];

      const [memories, timelineEvents, sessions] = await Promise.all([
        db.memory.findMany({ where: { userId, createdAt: { gte: startOfDay, lt: endOfDay }, isSensitive: false }, orderBy: { createdAt: "asc" }, take: 100 }),
        db.timelineEvent.findMany({ where: { userId, createdAt: { gte: startOfDay, lt: endOfDay } }, orderBy: { createdAt: "asc" }, take: 100 }),
        db.session.findMany({ where: { userId, startedAt: { gte: startOfDay, lt: endOfDay } }, orderBy: { startedAt: "asc" } }),
      ]);

      const memoryList = memories.map((m) => `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content).substring(0, 200)}`).join("\n");
      const timelineList = timelineEvents.map((e) => `[${e.type}] ${e.title}`).join("\n");
      const sessionList = sessions.map((s) => `"${s.title}"${s.task ? ` (${s.task})` : ""}`).join(", ");

      const systemPrompt = "Summarize today's activity. Respond in JSON: ```json\n{\"summary\": \"...\", \"topics\": [\"t1\"], \"projects\": [{\"name\": \"...\", \"sessionCount\": 0}], \"stats\": {\"sessionsCreated\": 0, \"memoriesCreated\": 0, \"decisionsMade\": 0}}\n```";
      const userMessage = `Summarize today (${dateStr}):\nSessions: ${sessionList || "None"}\nMemories (${memories.length}):\n${memoryList || "No memories."}\nTimeline (${timelineEvents.length}):\n${timelineList || "No events."}`;

      const completion = await zai.chat.completions.create({
        messages: [{ role: "assistant", content: systemPrompt }, { role: "user", content: userMessage }],
      });

      const aiContent = completion.choices?.[0]?.message?.content || "";
      let projects: Array<{ name: string; sessionCount: number; memoryCount: number }> = [];
      let stats = { sessionsCreated: sessions.length, memoriesCreated: memories.length, decisionsMade: memories.filter((m) => m.type === "decision").length, topDomains: getTopDomains(memories, timelineEvents) };

      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const parsed = JSON.parse((jsonMatch ? jsonMatch[1] : aiContent).trim());
        summaryText = parsed.summary || aiContent;
        topics = parsed.topics || [];
        projects = parsed.projects || [];
        stats = parsed.stats || stats;
      } catch { summaryText = aiContent; }

      await db.aIDailySummary.upsert({
        where: { date: dateStr },
        create: { date: dateStr, summary: summaryText, topics: JSON.stringify(topics), projects: JSON.stringify(projects), stats: JSON.stringify(stats), userId },
        update: { summary: summaryText, topics: JSON.stringify(topics), projects: JSON.stringify(projects), stats: JSON.stringify(stats) },
      });

      return NextResponse.json({ data: { type: "daily", date: dateStr, summary: summaryText, topics, projects, stats } });
    }

    if (type === "project") {
      if (!id) {
        return NextResponse.json({ error: "Project ID is required for project summaries" }, { status: 400 });
      }

      const project = await db.project.findUnique({ where: { id } });
      if (!project || project.userId !== userId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const sessions = await db.session.findMany({
        where: { project: project.name, userId },
        include: { memories: { orderBy: { createdAt: "asc" }, take: 30 } },
        orderBy: { startedAt: "desc" },
      });

      const allMemories = sessions.flatMap((s) => s.memories);
      const memoryList = allMemories.slice(0, 50).map((m) => `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content).substring(0, 200)}`).join("\n");

      const systemPrompt = "Summarize project progress. Respond in JSON: ```json\n{\"summary\": \"...\", \"topics\": [\"t1\"]}\n```";
      const userMessage = `Summarize project "${project.name}":\n${project.description ? `Description: ${project.description}` : ""}\nSessions (${sessions.length}):\nKey memories (${allMemories.length}):`;

      const completion = await zai.chat.completions.create({
        messages: [{ role: "assistant", content: systemPrompt }, { role: "user", content: userMessage }],
      });

      const aiContent = completion.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const parsed = JSON.parse((jsonMatch ? jsonMatch[1] : aiContent).trim());
        summaryText = parsed.summary || aiContent;
        topics = parsed.topics || [];
      } catch { summaryText = aiContent; }

      return NextResponse.json({ data: { type: "project", id, name: project.name, summary: summaryText, topics, sessionCount: sessions.length, memoryCount: allMemories.length } });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/ai/summarize] Error:", error);
    return NextResponse.json({ error: "AI summarization failed" }, { status: 500 });
  }
}

function getTopDomains(memories: Array<{ domain?: string | null }>, timelineEvents: Array<{ domain?: string | null }>) {
  const domainCounts = new Map<string, number>();
  for (const m of memories) { if (m.domain) domainCounts.set(m.domain, (domainCounts.get(m.domain) || 0) + 1); }
  for (const e of timelineEvents) { if (e.domain) domainCounts.set(e.domain, (domainCounts.get(e.domain) || 0) + 1); }
  return Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([domain, count]) => ({ domain, count }));
}
