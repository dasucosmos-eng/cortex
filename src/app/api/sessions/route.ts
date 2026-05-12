import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/sessions — List sessions with optional project filter and memory count
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const project = searchParams.get("project") || undefined;

    const where: Record<string, unknown> = {};
    if (project) {
      where.project = project;
    }

    const sessions = await db.session.findMany({
      where,
      orderBy: { startedAt: "desc" },
      include: {
        _count: {
          select: {
            memories: true,
            timeline: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: sessions.map((session) => ({
        ...session,
        memoryCount: session._count.memories,
        timelineCount: session._count.timeline,
        _count: undefined,
      })),
    });
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
    const body = await request.json();
    const { title, project, task, intent } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // End any currently active sessions
    await db.session.updateMany({
      where: { isActive: true },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    const session = await db.session.create({
      data: {
        title: title.trim(),
        project: project || null,
        task: task || null,
        intent: intent || null,
        isActive: true,
        startedAt: new Date(),
      },
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/sessions] Error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
