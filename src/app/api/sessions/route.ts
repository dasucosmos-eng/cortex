import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

// GET /api/sessions — List sessions with optional project filter and memory counts
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const project = searchParams.get("project") || undefined;

    // Build query — always filter by userId
    let query = adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .orderBy("startedAt", "desc");

    if (activeOnly) {
      query = query.where("isActive", "==", true);
    }
    if (project) {
      query = query.where("project", "==", project);
    }

    const snapshot = await query.get();
    const sessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Compute memory and timeline counts for each session
    // Firestore doesn't support joins, so we batch-query counts
    const sessionIds = sessions.map((s) => s.id);

    let memoryCounts: Record<string, number> = {};
    let timelineCounts: Record<string, number> = {};

    if (sessionIds.length > 0) {
      // Firestore 'in' queries support max 30 items per query
      const batchSize = 30;
      for (let i = 0; i < sessionIds.length; i += batchSize) {
        const batch = sessionIds.slice(i, i + batchSize);

        // Count memories per session
        const memSnapshot = await adminDb
          .collection("memories")
          .where("userId", "==", userId)
          .where("sessionId", "in", batch)
          .select("sessionId")
          .get();
        for (const doc of memSnapshot.docs) {
          const sid = doc.get("sessionId");
          if (sid) {
            memoryCounts[sid] = (memoryCounts[sid] || 0) + 1;
          }
        }

        // Count timeline events per session
        const tlSnapshot = await adminDb
          .collection("timeline")
          .where("userId", "==", userId)
          .where("sessionId", "in", batch)
          .select("sessionId")
          .get();
        for (const doc of tlSnapshot.docs) {
          const sid = doc.get("sessionId");
          if (sid) {
            timelineCounts[sid] = (timelineCounts[sid] || 0) + 1;
          }
        }
      }
    }

    const sessionsWithCounts = sessions.map((session) => ({
      ...session,
      memoryCount: memoryCounts[session.id] || 0,
      timelineCount: timelineCounts[session.id] || 0,
    }));

    return NextResponse.json({ data: sessionsWithCounts });
  } catch (error) {
    console.error("[GET /api/sessions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// POST /api/sessions — Create a new session (ends currently active ones)
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

    const body = await request.json();
    const { title, project, task, intent } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // End any currently active sessions for this user
    const activeSnapshot = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .where("isActive", "==", true)
      .get();

    const now = new Date().toISOString();

    if (!activeSnapshot.empty) {
      const batch = adminDb.batch();
      for (const doc of activeSnapshot.docs) {
        batch.update(doc.ref, {
          isActive: false,
          endedAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
    }

    // Create new session
    const sessionId = generateId();
    const sessionDoc = {
      userId,
      title: title.trim(),
      project: project || null,
      task: task || null,
      intent: intent || null,
      summary: null,
      isActive: true,
      tabCount: 0,
      startedAt: now,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("sessions").doc(sessionId).set(sessionDoc);

    return NextResponse.json(
      { data: { id: sessionId, ...sessionDoc } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/sessions] Error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
