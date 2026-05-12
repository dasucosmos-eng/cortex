import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import ZAI from "z-ai-web-dev-sdk";

// POST /api/ai/recall — AI recall endpoint to retrieve relevant context
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { query, context } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required and must be a non-empty string" }, { status: 400 });
    }

    const userId = session.user.id;

    const activeSession = await db.session.findFirst({
      where: { isActive: true, userId },
    });

    const searchTerms = query.trim().split(/\s+/);
    const memoryWhere: Record<string, unknown> = {
      userId,
      OR: searchTerms.map((term) => ({
        OR: [
          { content: { contains: term } },
          { summary: { contains: term } },
          { title: { contains: term } },
          { tags: { contains: term } },
        ],
      })),
      isSensitive: false,
    };

    if (activeSession) {
      memoryWhere.OR = [
        ...(Array.isArray(memoryWhere.OR) ? memoryWhere.OR : []),
        { sessionId: activeSession.id },
      ];
    }

    const relevantMemories = await db.memory.findMany({
      where: memoryWhere,
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    const timelineEvents = await db.timelineEvent.findMany({
      where: activeSession ? { userId, sessionId: activeSession.id } : { userId },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    const memoryContext = relevantMemories
      .map((m) => `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content).substring(0, 200)}`)
      .join("\n");

    const timelineContext = timelineEvents.map((e) => `[${e.type}] ${e.title}`).join("\n");

    const zai = await ZAI.create();

    const systemPrompt = `You are an AI memory recall assistant. Based on the user's query and the available context, provide a structured context capsule. Always respond in valid JSON format with the following structure:
{
  "currentProject": "name of current project or null",
  "currentTask": "current task description or null",
  "relevantMemories": [{"id": "...", "type": "...", "summary": "...", "relevance": "..."}],
  "timelineContext": [{"id": "...", "type": "...", "title": "...", "timeAgo": "..."}],
  "suggestedNextSteps": ["step1", "step2"]
}

Be concise and only include truly relevant information. Never include sensitive data.`;

    const userMessage = `Query: ${query.trim()}
${context ? `\nAdditional context: ${context}` : ""}

Available memories:
${memoryContext || "No memories found."}

Recent timeline:
${timelineContext || "No recent timeline events."}

${activeSession ? `Active session: "${activeSession.title}"${activeSession.task ? `, task: "${activeSession.task}"` : ""}${activeSession.project ? `, project: "${activeSession.project}"` : ""}` : "No active session."}`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const aiContent = completion.choices?.[0]?.message?.content || "";

    let contextCapsule;
    try {
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
      contextCapsule = JSON.parse(jsonStr.trim());
    } catch {
      contextCapsule = {
        currentProject: activeSession?.project || null,
        currentTask: activeSession?.task || null,
        relevantMemories: relevantMemories.map((m) => ({
          id: m.id, type: m.type, summary: m.summary || m.content.substring(0, 100), relevance: "matched",
        })),
        timelineContext: timelineEvents.map((e) => ({
          id: e.id, type: e.type, title: e.title, timeAgo: new Date().toISOString(),
        })),
        suggestedNextSteps: [],
        aiRawResponse: aiContent,
      };
    }

    return NextResponse.json({ data: contextCapsule });
  } catch (error) {
    console.error("[POST /api/ai/recall] Error:", error);
    return NextResponse.json({ error: "AI recall failed" }, { status: 500 });
  }
}
