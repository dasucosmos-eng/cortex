import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import ZAI from "z-ai-web-dev-sdk";

// POST /api/ai/recall — AI recall endpoint to retrieve relevant context
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { query, context } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required and must be a non-empty string" }, { status: 400 });
    }

    const userId = user.uid;

    // Get active session
    const activeSessionSnap = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    const activeSession = activeSessionSnap.docs.length > 0
      ? { id: activeSessionSnap.docs[0].id, ...activeSessionSnap.docs[0].data() }
      : null;

    // Search memories — Firestore doesn't support full-text search, fetch and filter
    const searchTerms = query.trim().split(/\s+/);
    const memoriesSnap = await adminDb
      .collection("memories")
      .where("userId", "==", userId)
      .where("isSensitive", "==", false)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const allMemories = memoriesSnap.docs.map((d) => d.data());
    const lowerTerms = searchTerms.map((t) => t.toLowerCase());

    // Filter memories by text match
    const relevantMemories = allMemories.filter((m: any) => {
      const text = [m.content, m.summary, m.title, m.tags].filter(Boolean).join(" ").toLowerCase();
      return lowerTerms.some((term) => text.includes(term));
    }).slice(0, 10);

    // Get timeline events
    let timelineQuery = adminDb
      .collection("timeline")
      .where("userId", "==", userId);

    if (activeSession) {
      timelineQuery = timelineQuery.where("sessionId", "==", activeSession.id);
    }

    const timelineSnap = await timelineQuery
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();

    const timelineEvents = timelineSnap.docs.map((d) => d.data());

    const memoryContext = relevantMemories
      .map((m: any) => `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content || "").substring(0, 200)}`)
      .join("\n");

    const timelineContext = timelineEvents.map((e: any) => `[${e.type}] ${e.title}`).join("\n");

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
        relevantMemories: relevantMemories.map((m: any) => ({
          id: m.id, type: m.type, summary: m.summary || (m.content || "").substring(0, 100), relevance: "matched",
        })),
        timelineContext: timelineEvents.map((e: any) => ({
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
