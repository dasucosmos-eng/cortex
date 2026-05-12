import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

interface SearchResultItem {
  id: string;
  type: "memory" | "session" | "timeline";
  title: string;
  content: string;
  score: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Calculate a simple text relevance score based on term frequency and position.
 */
function calculateScore(
  text: string,
  query: string,
  queryTerms: string[]
): number {
  if (!text || !query) return 0;

  const lowerText = text.toLowerCase();
  let score = 0;

  if (lowerText.includes(query.toLowerCase())) {
    score += 10;
  }

  for (const term of queryTerms) {
    if (!term) continue;
    const lowerTerm = term.toLowerCase();
    let index = lowerText.indexOf(lowerTerm);
    let count = 0;
    while (index !== -1) {
      count++;
      if (index < 100) score += 3;
      else if (index < 200) score += 2;
      else score += 1;
      index = lowerText.indexOf(lowerTerm, index + 1);
    }
    if (count > 1) score += count * 0.5;
  }

  return score;
}

// GET /api/search — Semantic search endpoint
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || undefined;
    const projectId = searchParams.get("projectId") || undefined;

    if (!query.trim()) {
      return NextResponse.json(
        { error: "Search query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const queryTerms = query.trim().split(/\s+/);
    const results: SearchResultItem[] = [];
    const userId = session.user.id;

    // Search memories
    const memoryWhere: Record<string, unknown> = { userId };
    if (type) memoryWhere.type = type;
    if (projectId) memoryWhere.projectId = projectId;

    const memories = await db.memory.findMany({
      where: {
        ...memoryWhere,
        OR: [
          { content: { contains: query } },
          { summary: { contains: query } },
          { title: { contains: query } },
          { tags: { contains: query } },
        ],
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    for (const memory of memories) {
      const searchableText = [
        memory.content,
        memory.summary,
        memory.title,
        memory.tags,
      ]
        .filter(Boolean)
        .join(" ");
      const score = calculateScore(searchableText, query, queryTerms);
      if (score > 0) {
        results.push({
          id: memory.id,
          type: "memory",
          title: memory.title || "Untitled Memory",
          content: memory.summary || memory.content,
          score,
          createdAt: memory.createdAt.toISOString(),
          metadata: {
            memoryType: memory.type,
            url: memory.url,
            domain: memory.domain,
            sessionId: memory.sessionId,
            projectId: memory.projectId,
          },
        });
      }
    }

    // Search sessions
    const sessions = await db.session.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: query } },
          { task: { contains: query } },
          { intent: { contains: query } },
          { summary: { contains: query } },
        ],
      },
      take: 20,
      orderBy: { startedAt: "desc" },
    });

    for (const sessionItem of sessions) {
      const searchableText = [
        sessionItem.title,
        sessionItem.task,
        sessionItem.intent,
        sessionItem.summary,
      ]
        .filter(Boolean)
        .join(" ");
      const score = calculateScore(searchableText, query, queryTerms);
      if (score > 0) {
        results.push({
          id: sessionItem.id,
          type: "session",
          title: sessionItem.title,
          content: sessionItem.task || sessionItem.summary || sessionItem.intent || "",
          score,
          createdAt: sessionItem.startedAt.toISOString(),
          metadata: {
            isActive: sessionItem.isActive,
            project: sessionItem.project,
          },
        });
      }
    }

    // Search timeline events
    const timelineWhere: Record<string, unknown> = { userId };
    if (type) timelineWhere.type = type;

    const timelineEvents = await db.timelineEvent.findMany({
      where: {
        ...timelineWhere,
        OR: [
          { title: { contains: query } },
          { metadata: { contains: query } },
          { domain: { contains: query } },
        ],
      },
      take: 30,
      orderBy: { createdAt: "desc" },
    });

    for (const event of timelineEvents) {
      const searchableText = [event.title, event.domain, event.metadata]
        .filter(Boolean)
        .join(" ");
      const score = calculateScore(searchableText, query, queryTerms);
      if (score > 0) {
        results.push({
          id: event.id,
          type: "timeline",
          title: event.title,
          content: event.domain || "",
          score,
          createdAt: event.createdAt.toISOString(),
          metadata: {
            eventType: event.type,
            url: event.url,
            sessionId: event.sessionId,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    // Log the search query
    await db.searchQuery.create({
      data: {
        query: query.trim(),
        results: JSON.stringify(results.slice(0, 20).map((r) => r.id)),
        filters: JSON.stringify({ type, projectId }),
        userId,
      },
    });

    return NextResponse.json({
      data: results.slice(0, 20),
      total: results.length,
      query: query.trim(),
    });
  } catch (error) {
    console.error("[GET /api/search] Error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

// POST /api/search — Advanced search with filters in body
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      q = "",
      type,
      projectId,
      domain,
      tags,
      dateRange,
      isSensitive,
      limit = 20,
    } = body;

    if (!q.trim()) {
      return NextResponse.json(
        { error: "Search query 'q' is required" },
        { status: 400 }
      );
    }

    const query = q.trim();
    const queryTerms = query.split(/\s+/);
    const where: Record<string, unknown> = { userId: session.user.id };

    if (type) {
      if (Array.isArray(type)) {
        where.type = { in: type };
      } else {
        where.type = type;
      }
    }
    if (projectId) {
      if (Array.isArray(projectId)) {
        where.projectId = { in: projectId };
      } else {
        where.projectId = projectId;
      }
    }
    if (domain) {
      if (Array.isArray(domain)) {
        where.domain = { in: domain };
      } else {
        where.domain = domain;
      }
    }
    if (isSensitive !== undefined) {
      where.isSensitive = Boolean(isSensitive);
    }
    if (dateRange) {
      where.createdAt = {};
      if (dateRange.start) {
        (where.createdAt as Record<string, unknown>).gte = new Date(
          dateRange.start
        );
      }
      if (dateRange.end) {
        (where.createdAt as Record<string, unknown>).lte = new Date(
          dateRange.end
        );
      }
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      const tagConditions = tags.map((tag: string) => ({
        tags: { contains: tag },
      }));
      where.OR = [...(where.OR as unknown[] || []), ...tagConditions];
    }

    const textSearchConditions = [
      { content: { contains: query } },
      { summary: { contains: query } },
      { title: { contains: query } },
    ];

    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        textSearchConditions.push({ tags: { contains: tag } });
      }
    }

    if (where.OR) {
      where.AND = [
        { OR: textSearchConditions },
        { OR: where.OR as unknown[] },
      ];
      delete where.OR;
    } else {
      where.OR = textSearchConditions;
    }

    const memories = await db.memory.findMany({
      where,
      take: Math.min(100, Math.max(1, limit)),
      orderBy: { createdAt: "desc" },
    });

    const results = memories
      .map((memory) => {
        const searchableText = [
          memory.content,
          memory.summary,
          memory.title,
          memory.tags,
        ]
          .filter(Boolean)
          .join(" ");
        const score = calculateScore(searchableText, query, queryTerms);
        return {
          id: memory.id,
          type: "memory" as const,
          title: memory.title || "Untitled Memory",
          content: memory.summary || memory.content,
          score,
          createdAt: memory.createdAt.toISOString(),
          metadata: {
            memoryType: memory.type,
            url: memory.url,
            domain: memory.domain,
            sessionId: memory.sessionId,
            projectId: memory.projectId,
            isSensitive: memory.isSensitive,
          },
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    await db.searchQuery.create({
      data: {
        query,
        results: JSON.stringify(results.slice(0, 50).map((r) => r.id)),
        filters: JSON.stringify({ type, projectId, domain, tags, dateRange, isSensitive }),
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      data: results,
      total: results.length,
      query,
      filters: { type, projectId, domain, tags, dateRange, isSensitive },
    });
  } catch (error) {
    console.error("[POST /api/search] Error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
