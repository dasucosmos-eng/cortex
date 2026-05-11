import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/timeline — List timeline events with filters and pagination
export async function GET(request: NextRequest) {
  try {
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

    const where: Record<string, unknown> = {};

    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (type) {
      where.type = type;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const [events, total] = await Promise.all([
      db.timelineEvent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          session: {
            select: { id: true, title: true },
          },
        },
      }),
      db.timelineEvent.count({ where }),
    ]);

    return NextResponse.json({
      data: events,
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

    let serializedMetadata: string | undefined;
    if (metadata) {
      serializedMetadata =
        typeof metadata === "string" ? metadata : JSON.stringify(metadata);
    }

    const event = await db.timelineEvent.create({
      data: {
        type: type.trim(),
        title: title.trim(),
        url: url || null,
        domain: domain || null,
        sessionId: sessionId || null,
        metadata: serializedMetadata || null,
      },
      include: {
        session: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/timeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to create timeline event" },
      { status: 500 }
    );
  }
}
