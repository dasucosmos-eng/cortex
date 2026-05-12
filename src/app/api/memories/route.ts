import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/memories — List memories with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const type = searchParams.get("type") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const sessionId = searchParams.get("sessionId") || undefined;
    const isSensitive = searchParams.get("isSensitive");
    const query = searchParams.get("q") || undefined;

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }
    if (projectId) {
      where.projectId = projectId;
    }
    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (isSensitive !== null && isSensitive !== undefined && isSensitive !== "") {
      where.isSensitive = isSensitive === "true";
    }
    if (query) {
      where.OR = [
        { content: { contains: query } },
        { summary: { contains: query } },
        { title: { contains: query } },
        { tags: { contains: query } },
      ];
    }

    const [memories, total] = await Promise.all([
      db.memory.findMany({
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
      db.memory.count({ where }),
    ]);

    const parsedMemories = memories.map((memory) => {
      let parsedTags: string[] = [];
      try {
        parsedTags = memory.tags ? JSON.parse(memory.tags) : [];
      } catch {
        parsedTags = memory.tags ? [memory.tags] : [];
      }

      return {
        ...memory,
        tags: parsedTags,
      };
    });

    return NextResponse.json({
      data: parsedMemories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/memories] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch memories" },
      { status: 500 }
    );
  }
}

// POST /api/memories — Create a new memory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      content,
      type = "general",
      url,
      domain,
      title,
      projectId,
      tags,
      isSensitive = false,
      sessionId,
      summary,
      metadata,
    } = body;

    // Validate required fields
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (type && !["general", "code", "research", "decision", "reference", "snippet"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid memory type. Must be one of: general, code, research, decision, reference, snippet" },
        { status: 400 }
      );
    }

    // Auto-generate summary if not provided (simple truncation)
    const generatedSummary =
      summary ||
      (content.length > 200 ? content.substring(0, 197) + "..." : content);

    // Validate and serialize tags
    let serializedTags: string | undefined;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      serializedTags = JSON.stringify(
        tagArray.map((t: string) => String(t).trim()).filter(Boolean)
      );
    }

    const memory = await db.memory.create({
      data: {
        content: content.trim(),
        type,
        url: url || null,
        domain: domain || null,
        title: title || null,
        projectId: projectId || null,
        sessionId: sessionId || null,
        tags: serializedTags || null,
        isSensitive: Boolean(isSensitive),
        summary: generatedSummary,
        metadata: metadata || null,
      },
      include: {
        session: {
          select: { id: true, title: true },
        },
      },
    });

    let parsedTags: string[] = [];
    try {
      parsedTags = memory.tags ? JSON.parse(memory.tags) : [];
    } catch {
      parsedTags = memory.tags ? [memory.tags] : [];
    }

    return NextResponse.json(
      { data: { ...memory, tags: parsedTags } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/memories] Error:", error);
    return NextResponse.json(
      { error: "Failed to create memory" },
      { status: 500 }
    );
  }
}
