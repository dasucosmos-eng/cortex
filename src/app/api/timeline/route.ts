import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

// GET /api/timeline — List timeline events with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const sessionId = searchParams.get("sessionId") || undefined;
    const type = searchParams.get("type") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    // Build Firestore query — always filter by userId
    let query: FirebaseFirestore.Query = adminDb
      .collection("timeline")
      .where("userId", "==", userId);

    // Firestore requires composite indexes for inequality filters combined with ordering
    // We'll apply date range filters server-side to avoid index issues

    // Apply equality filters that are safe with the query
    if (sessionId) {
      query = query.where("sessionId", "==", sessionId);
    }
    if (type) {
      query = query.where("type", "==", type);
    }

    // Order by createdAt desc
    query = query.orderBy("createdAt", "desc");

    // Fetch a reasonable set and filter dates in JS (avoids composite index requirements)
    const fetchLimit = Math.min(500, Math.max(100, (page + 1) * limit));
    const snapshot = await query.limit(fetchLimit).get();

    let events: Array<Record<string, any>> = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, any>),
    }));

    // Apply date range filters in JS
    if (startDate || endDate) {
      events = events.filter((event) => {
        const created = event.createdAt as string;
        if (startDate && created < startDate) return false;
        if (endDate && created > endDate) return false;
        return true;
      });
    }

    const total = events.length;

    // Paginate
    const start = (page - 1) * limit;
    const paginatedEvents = events.slice(start, start + limit);

    // Enrich with session info for events that have a sessionId
    const enrichedEvents: Array<Record<string, any>> = await Promise.all(
      paginatedEvents.map(async (event) => {
        let session: Record<string, any> | null = null;
        if (event.sessionId) {
          const sessionDoc = await adminDb
            .collection("sessions")
            .doc(String(event.sessionId))
            .get();
          if (sessionDoc.exists) {
            session = {
              id: sessionDoc.id,
              title: sessionDoc.get("title"),
            };
          }
        }
        return { ...event, session };
      })
    );

    return NextResponse.json({
      data: enrichedEvents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/timeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline events" },
      { status: 500 }
    );
  }
}

// POST /api/timeline — Create a timeline event
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

    const body = await request.json();
    const { type, title, url, domain, sessionId, metadata } = body;

    if (!type || typeof type !== "string" || type.trim().length === 0) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const validTypes = [
      "tab_opened",
      "tab_closed",
      "search",
      "navigation",
      "coding",
      "decision",
      "note_created",
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: `Invalid timeline event type. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Serialize metadata
    let serializedMetadata: string | undefined;
    if (metadata) {
      serializedMetadata =
        typeof metadata === "string" ? metadata : JSON.stringify(metadata);
    }

    const now = new Date().toISOString();
    const eventId = generateId();

    const eventDoc = {
      userId,
      type: type.trim(),
      title: title.trim(),
      url: url || null,
      domain: domain || null,
      sessionId: sessionId || null,
      metadata: serializedMetadata || null,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("timeline").doc(eventId).set(eventDoc);

    // Enrich with session info if sessionId provided
    let session: Record<string, unknown> | null = null;
    if (sessionId) {
      const sessionDoc = await adminDb
        .collection("sessions")
        .doc(sessionId)
        .get();
      if (sessionDoc.exists) {
        session = {
          id: sessionDoc.id,
          title: sessionDoc.get("title"),
        };
      }
    }

    return NextResponse.json(
      { data: { id: eventId, ...eventDoc, session } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/timeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to create timeline event" },
      { status: 500 }
    );
  }
}
