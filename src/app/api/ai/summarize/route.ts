import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

// POST /api/ai/summarize — Generate AI summaries
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, id } = body;

    if (!type || !["session", "daily", "project"].includes(type)) {
      return NextResponse.json({ error: "Type must be one of: session, daily, project" }, { status: 400 });
    }

    const userId = user.uid;
    const zai = await ZAI.create();
    let summaryText = "";
    let topics: string[] = [];

    if (type === "session") {
      if (!id) {
        return NextResponse.json({ error: "Session ID is required for session summaries" }, { status: 400 });
      }

      const sessionDoc = await adminDb.collection("sessions").doc(id).get();
      if (!sessionDoc.exists) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const sessionData = sessionDoc.data();
      if (sessionData.userId !== userId) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Get memories and timeline for this session
      const [memoriesSnap, timelineSnap] = await Promise.all([
        adminDb
          .collection("memories")
          .where("userId", "==", userId)
          .where("sessionId", "==", id)
          .orderBy("createdAt", "asc")
          .limit(50)
          .get(),
        adminDb
          .collection("timeline")
          .where("userId", "==", userId)
          .where("sessionId", "==", id)
          .orderBy("createdAt", "asc")
          .limit(50)
          .get(),
      ]);

      const memories = memoriesSnap.docs.map((d) => d.data());
      const timeline = timelineSnap.docs.map((d) => d.data());

      const memoryList = memories.map((m: any) => `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content || "").substring(0, 300)}`).join("\n");
      const timelineList = timeline.map((e: any) => `[${e.type}] ${e.title}`).join("\n");

      const systemPrompt = "You are an AI assistant that summarizes browser sessions. Provide a concise summary. Respond in JSON: ```json\n{\"summary\": \"...\", \"topics\": [\"topic1\"]}\n```";
      const userMessage = `Summarize this session titled "${sessionData.title || ""}":\n${sessionData.task ? `Task: ${sessionData.task}` : ""}\nMemories:\n${memoryList || "No memories."}\nTimeline:\n${timelineList || "No timeline events."}`;

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

      await adminDb.collection("sessions").doc(id).update({ summary: summaryText });

      return NextResponse.json({ data: { type: "session", id, summary: summaryText, topics } });
    }

    if (type === "daily") {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const dateStr = today.toISOString().split("T")[0];

      const [memoriesSnap, timelineSnap, sessionsSnap] = await Promise.all([
        adminDb
          .collection("memories")
          .where("userId", "==", userId)
          .where("isSensitive", "==", false)
          .orderBy("createdAt", "asc")
          .limit(100)
          .get(),
        adminDb
          .collection("timeline")
          .where("userId", "==", userId)
          .orderBy("createdAt", "asc")
          .limit(100)
          .get(),
        adminDb
          .collection("sessions")
          .where("userId", "==", userId)
          .orderBy("startedAt", "asc")
          .get(),
      ]);

      // Filter by date range in JS (Firestore can't do range + userId composite index easily)
      const startMs = startOfDay.getTime();
      const endMs = endOfDay.getTime();

      const memories = memoriesSnap.docs
        .map((d) => d.data())
        .filter((m: any) => {
          const t = new Date(m.createdAt).getTime();
          return t >= startMs && t < endMs;
        });

      const timelineEvents = timelineSnap.docs
        .map((d) => d.data())
        .filter((e: any) => {
          const t = new Date(e.createdAt).getTime();
          return t >= startMs && t < endMs;
        });

      const sessions = sessionsSnap.docs
        .map((d) => d.data())
        .filter((s: any) => {
          const t = new Date(s.startedAt).getTime();
          return t >= startMs && t < endMs;
        });

      const memoryList = memories.map((m: any) => `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content || "").substring(0, 200)}`).join("\n");
      const timelineList = timelineEvents.map((e: any) => `[${e.type}] ${e.title}`).join("\n");
      const sessionList = sessions.map((s: any) => `"${s.title}"${s.task ? ` (${s.task})` : ""}`).join(", ");

      const systemPrompt = "Summarize today's activity. Respond in JSON: ```json\n{\"summary\": \"...\", \"topics\": [\"t1\"], \"projects\": [{\"name\": \"...\", \"sessionCount\": 0}], \"stats\": {\"sessionsCreated\": 0, \"memoriesCreated\": 0, \"decisionsMade\": 0}}\n```";
      const userMessage = `Summarize today (${dateStr}):\nSessions: ${sessionList || "None"}\nMemories (${memories.length}):\n${memoryList || "No memories."}\nTimeline (${timelineEvents.length}):\n${timelineList || "No events."}`;

      const completion = await zai.chat.completions.create({
        messages: [{ role: "assistant", content: systemPrompt }, { role: "user", content: userMessage }],
      });

      const aiContent = completion.choices?.[0]?.message?.content || "";
      let projects: Array<{ name: string; sessionCount: number; memoryCount: number }> = [];
      let stats = { sessionsCreated: sessions.length, memoriesCreated: memories.length, decisionsMade: memories.filter((m: any) => m.type === "decision").length, topDomains: getTopDomains(memories, timelineEvents) };

      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const parsed = JSON.parse((jsonMatch ? jsonMatch[1] : aiContent).trim());
        summaryText = parsed.summary || aiContent;
        topics = parsed.topics || [];
        projects = parsed.projects || [];
        stats = parsed.stats || stats;
      } catch { summaryText = aiContent; }

      // Upsert daily summary in Firestore
      const summaryDocRef = adminDb
        .collection("aiDailySummaries")
        .where("userId", "==", userId)
        .where("date", "==", dateStr)
        .limit(1)
        .get();

      const summaryData = {
        date: dateStr,
        summary: summaryText,
        topics: JSON.stringify(topics),
        projects: JSON.stringify(projects),
        stats: JSON.stringify(stats),
        userId,
        updatedAt: new Date().toISOString(),
      };

      const existingSummary = (await summaryDocRef).docs[0];
      if (existingSummary) {
        await adminDb.collection("aiDailySummaries").doc(existingSummary.id).update(summaryData);
      } else {
        await adminDb.collection("aiDailySummaries").doc(generateId()).set({
          ...summaryData,
          createdAt: new Date().toISOString(),
        });
      }

      return NextResponse.json({ data: { type: "daily", date: dateStr, summary: summaryText, topics, projects, stats } });
    }

    if (type === "project") {
      if (!id) {
        return NextResponse.json({ error: "Project ID is required for project summaries" }, { status: 400 });
      }

      const projectDoc = await adminDb.collection("projects").doc(id).get();
      if (!projectDoc.exists) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const project = projectDoc.data();
      if (project.userId !== userId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // Get sessions for this project
      const sessionsSnap = await adminDb
        .collection("sessions")
        .where("userId", "==", userId)
        .where("project", "==", project.name)
        .orderBy("startedAt", "desc")
        .get();

      const sessionDocs = sessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Get memories for all these sessions
      let allMemories: any[] = [];
      for (const s of sessionDocs.slice(0, 20)) {
        const memSnap = await adminDb
          .collection("memories")
          .where("userId", "==", userId)
          .where("sessionId", "==", s.id)
          .orderBy("createdAt", "asc")
          .limit(30)
          .get();
        allMemories.push(...memSnap.docs.map((d) => d.data()));
      }

      const memoryList = allMemories.slice(0, 50).map((m: any) => `[${m.type}] ${m.title || "Untitled"}: ${(m.summary || m.content || "").substring(0, 200)}`).join("\n");

      const systemPrompt = "Summarize project progress. Respond in JSON: ```json\n{\"summary\": \"...\", \"topics\": [\"t1\"]}\n```";
      const userMessage = `Summarize project "${project.name}":\n${project.description ? `Description: ${project.description}` : ""}\nSessions (${sessionDocs.length}):\nKey memories (${allMemories.length}):`;

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

      return NextResponse.json({ data: { type: "project", id, name: project.name, summary: summaryText, topics, sessionCount: sessionDocs.length, memoryCount: allMemories.length } });
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
