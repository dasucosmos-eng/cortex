import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

// POST /api/ai/summarize — Generate AI summaries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id } = body;

    if (!type || !["session", "daily", "project"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be one of: session, daily, project" },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();
    let summaryText = "";
    let topics: string[] = [];

    if (type === "session") {
      if (!id) {
        return NextResponse.json(
          { error: "Session ID is required for session summaries" },
          { status: 400 }
        );
      }

      const session = await db.session.findUnique({
        where: { id },
        include: {
          memories: {
            orderBy: { createdAt: "asc" },
            take: 50,
          },
          timeline: {
            orderBy: { createdAt: "asc" },
            take: 50,
          },
        },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      const memoryList = session.memories
        .map(
          (m) =>
            `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content).substring(0, 300)}`
        )
        .join("\n");

      const timelineList = session.timeline
        .map((e) => `[${e.type}] ${e.title}`)
        .join("\n");

      const systemPrompt =
        "You are an AI assistant that summarizes browser sessions. Provide a concise, well-organized summary of what was accomplished during this session. Include key topics, decisions made, and important findings. Also suggest 3-5 topic tags that summarize the session. Respond in the following JSON format:\n```json\n{\n  \"summary\": \"...\",\n  \"topics\": [\"topic1\", \"topic2\"]\n}\n```";

      const userMessage = `Summarize this session titled "${session.title}":
${session.task ? `Task: ${session.task}` : ""}
${session.intent ? `Intent: ${session.intent}` : ""}

Memories:
${memoryList || "No memories recorded."}

Timeline events:
${timelineList || "No timeline events recorded."}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const aiContent = completion.choices?.[0]?.message?.content || "";

      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
        const parsed = JSON.parse(jsonStr.trim());
        summaryText = parsed.summary || aiContent;
        topics = parsed.topics || [];
      } catch {
        summaryText = aiContent;
      }

      // Update the session with the summary
      await db.session.update({
        where: { id },
        data: { summary: summaryText },
      });

      return NextResponse.json({
        data: {
          type: "session",
          id,
          summary: summaryText,
          topics,
        },
      });
    }

    if (type === "daily") {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      );
      const dateStr = today.toISOString().split("T")[0];

      const [memories, timelineEvents, sessions] = await Promise.all([
        db.memory.findMany({
          where: {
            createdAt: { gte: startOfDay, lt: endOfDay },
            isSensitive: false,
          },
          orderBy: { createdAt: "asc" },
          take: 100,
        }),
        db.timelineEvent.findMany({
          where: { createdAt: { gte: startOfDay, lt: endOfDay } },
          orderBy: { createdAt: "asc" },
          take: 100,
        }),
        db.session.findMany({
          where: { startedAt: { gte: startOfDay, lt: endOfDay } },
          orderBy: { startedAt: "asc" },
        }),
      ]);

      const memoryList = memories
        .map(
          (m) =>
            `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content).substring(0, 200)}`
        )
        .join("\n");

      const timelineList = timelineEvents
        .map((e) => `[${e.type}] ${e.title}`)
        .join("\n");

      const sessionList = sessions
        .map((s) => `"${s.title}"${s.task ? ` (${s.task})` : ""}`)
        .join(", ");

      const systemPrompt =
        "You are an AI assistant that creates daily activity summaries. Summarize what was accomplished today, key topics explored, decisions made, and overall productivity. Also suggest topic tags. Respond in JSON format:\n```json\n{\n  \"summary\": \"...\",\n  \"topics\": [\"topic1\", \"topic2\"],\n  \"projects\": [{\"name\": \"...\", \"sessionCount\": 0, \"memoryCount\": 0}],\n  \"stats\": {\"sessionsCreated\": 0, \"memoriesCreated\": 0, \"decisionsMade\": 0, \"topDomains\": [{\"domain\": \"...\", \"count\": 0}]}\n}\n```";

      const userMessage = `Summarize today's activity (${dateStr}):

Sessions: ${sessionList || "None"}

Memories (${memories.length}):
${memoryList || "No memories."}

Timeline events (${timelineEvents.length}):
${timelineList || "No timeline events."}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const aiContent = completion.choices?.[0]?.message?.content || "";

      let projects: Array<{ name: string; sessionCount: number; memoryCount: number }> = [];
      let stats = {
        sessionsCreated: sessions.length,
        memoriesCreated: memories.length,
        decisionsMade: memories.filter((m) => m.type === "decision").length,
        topDomains: getTopDomains(memories, timelineEvents),
      };

      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
        const parsed = JSON.parse(jsonStr.trim());
        summaryText = parsed.summary || aiContent;
        topics = parsed.topics || [];
        projects = parsed.projects || [];
        stats = parsed.stats || stats;
      } catch {
        summaryText = aiContent;
      }

      // Store in AIDailySummary
      await db.aIDailySummary.upsert({
        where: { date: dateStr },
        create: {
          date: dateStr,
          summary: summaryText,
          topics: JSON.stringify(topics),
          projects: JSON.stringify(projects),
          stats: JSON.stringify(stats),
        },
        update: {
          summary: summaryText,
          topics: JSON.stringify(topics),
          projects: JSON.stringify(projects),
          stats: JSON.stringify(stats),
        },
      });

      return NextResponse.json({
        data: {
          type: "daily",
          date: dateStr,
          summary: summaryText,
          topics,
          projects,
          stats,
        },
      });
    }

    if (type === "project") {
      if (!id) {
        return NextResponse.json(
          { error: "Project ID is required for project summaries" },
          { status: 400 }
        );
      }

      const project = await db.project.findUnique({
        where: { id },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      // Find sessions related to this project
      const sessions = await db.session.findMany({
        where: { project: project.name },
        include: {
          memories: {
            orderBy: { createdAt: "asc" },
            take: 30,
          },
        },
        orderBy: { startedAt: "desc" },
      });

      const allMemories = sessions.flatMap((s) => s.memories);
      const memoryList = allMemories
        .slice(0, 50)
        .map(
          (m) =>
            `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content).substring(0, 200)}`
        )
        .join("\n");

      const sessionList = sessions
        .map(
          (s) =>
            `"${s.title}"${s.task ? ` (${s.task})` : ""} - ${s.memories.length} memories`
        )
        .join("\n");

      const systemPrompt =
        "You are an AI assistant that creates project summaries. Summarize the overall progress, key accomplishments, important decisions, and current status of the project. Suggest topic tags. Respond in JSON format:\n```json\n{\n  \"summary\": \"...\",\n  \"topics\": [\"topic1\", \"topic2\"]\n}\n```";

      const userMessage = `Summarize the project "${project.name}":
${project.description ? `Description: ${project.description}` : "No description."}

Sessions (${sessions.length}):
${sessionList || "No sessions."}

Key memories (${allMemories.length} total, showing first 50):
${memoryList || "No memories."}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const aiContent = completion.choices?.[0]?.message?.content || "";

      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
        const parsed = JSON.parse(jsonStr.trim());
        summaryText = parsed.summary || aiContent;
        topics = parsed.topics || [];
      } catch {
        summaryText = aiContent;
      }

      return NextResponse.json({
        data: {
          type: "project",
          id,
          name: project.name,
          summary: summaryText,
          topics,
          sessionCount: sessions.length,
          memoryCount: allMemories.length,
        },
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/ai/summarize] Error:", error);
    return NextResponse.json(
      { error: "AI summarization failed" },
      { status: 500 }
    );
  }
}

/** Helper to extract top domains from memories and timeline events. */
function getTopDomains(
  memories: Array<{ domain?: string | null }>,
  timelineEvents: Array<{ domain?: string | null }>
): Array<{ domain: string; count: number }> {
  const domainCounts = new Map<string, number>();

  for (const m of memories) {
    if (m.domain) {
      domainCounts.set(m.domain, (domainCounts.get(m.domain) || 0) + 1);
    }
  }
  for (const e of timelineEvents) {
    if (e.domain) {
      domainCounts.set(e.domain, (domainCounts.get(e.domain) || 0) + 1);
    }
  }

  return Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));
}
