import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/hybrid-memory — List hybrid memories with tier filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier");
    const minImportance = searchParams.get("minImportance");
    const includeArchived = searchParams.get("includeArchived") === "true";
    const sortBy = searchParams.get("sortBy") || "lastAccessed"; // importance, lastAccessed, accessCount
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const where: Record<string, unknown> = {};

    if (tier) {
      const validTiers = ["short_term", "long_term", "episodic", "semantic", "procedural"];
      if (validTiers.includes(tier)) {
        where.memoryTier = tier;
      } else {
        return NextResponse.json(
          { error: `Invalid tier. Must be one of: ${validTiers.join(", ")}` },
          { status: 400 }
        );
      }
    }

    if (minImportance) {
      where.importance = { gte: parseFloat(minImportance) };
    }

    if (!includeArchived) {
      where.isArchived = false;
    }

    const orderBy: Record<string, string> = {};
    if (["importance", "lastAccessed", "accessCount"].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.lastAccessed = "desc";
    }

    const [hybridMemories, total] = await Promise.all([
      db.hybridMemory.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
      db.hybridMemory.count({ where }),
    ]);

    return NextResponse.json({
      data: hybridMemories,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[GET /api/hybrid-memory] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch hybrid memories" },
      { status: 500 }
    );
  }
}

// POST /api/hybrid-memory — Promote/demote memory tier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { memoryId, newTier } = body;

    if (!memoryId || typeof memoryId !== "string") {
      return NextResponse.json(
        { error: "memoryId is required" },
        { status: 400 }
      );
    }

    const validTiers = ["short_term", "long_term", "episodic", "semantic", "procedural"];
    if (!newTier || !validTiers.includes(newTier)) {
      return NextResponse.json(
        { error: `newTier is required. Must be one of: ${validTiers.join(", ")}` },
        { status: 400 }
      );
    }

    // Find existing hybrid memory record
    const existing = await db.hybridMemory.findFirst({
      where: { memoryId },
    });

    let hybridMemory;
    if (existing) {
      hybridMemory = await db.hybridMemory.update({
        where: { id: existing.id },
        data: {
          memoryTier: newTier,
          lastAccessed: new Date(),
        },
      });
    } else {
      hybridMemory = await db.hybridMemory.create({
        data: {
          memoryId,
          memoryTier: newTier,
        },
      });
    }

    return NextResponse.json({ data: hybridMemory });
  } catch (error) {
    console.error("[POST /api/hybrid-memory] Error:", error);
    return NextResponse.json(
      { error: "Failed to update memory tier" },
      { status: 500 }
    );
  }
}
