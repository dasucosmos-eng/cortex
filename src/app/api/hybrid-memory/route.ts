import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

// GET /api/hybrid-memory — List hybrid memories with tier filter
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier");
    const minImportance = searchParams.get("minImportance");
    const includeArchived = searchParams.get("includeArchived") === "true";
    const sortBy = searchParams.get("sortBy") || "lastAccessed";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    if (tier) {
      const validTiers = ["short_term", "long_term", "episodic", "semantic", "procedural"];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: `Invalid tier. Must be one of: ${validTiers.join(", ")}` }, { status: 400 });
      }
    }

    // Get user's memory IDs for ownership filtering (HybridMemory has no userId field)
    const userMemoriesSnap = await adminDb
      .collection("memories")
      .where("userId", "==", userId)
      .select("__name__")
      .get();
    const memoryIdList = userMemoriesSnap.docs.map((d) => d.id);

    // Build query on hybridMemories
    // Firestore doesn't support "in" on more than 30 items — for simplicity, batch or filter in JS
    let hybridSnap;
    const orderByField = ["importance", "lastAccessed", "accessCount"].includes(sortBy) ? sortBy : "lastAccessed";
    const orderDir = sortOrder === "asc" ? "asc" : "desc";

    if (memoryIdList.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { offset, limit, total: 0, hasMore: false },
      });
    }

    // Fetch all hybrid memories — filter by memoryId in JS
    hybridSnap = await adminDb
      .collection("hybridMemories")
      .orderBy(orderByField, orderDir as "asc" | "desc")
      .limit(500)
      .get();

    const allHybrid = hybridSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((hm: any) => memoryIdList.includes(hm.memoryId));

    // Apply additional filters
    let filtered = allHybrid;
    if (tier) {
      filtered = filtered.filter((hm: any) => hm.memoryTier === tier);
    }
    if (minImportance !== null) {
      const minVal = parseFloat(minImportance!);
      filtered = filtered.filter((hm: any) => (hm.importance || 0) >= minVal);
    }
    if (!includeArchived) {
      filtered = filtered.filter((hm: any) => hm.isArchived !== true);
    }

    const total = filtered.length;
    const hybridMemories = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      data: hybridMemories,
      pagination: { offset, limit, total, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error("[GET /api/hybrid-memory] Error:", error);
    return NextResponse.json({ error: "Failed to fetch hybrid memories" }, { status: 500 });
  }
}

// POST /api/hybrid-memory — Promote/demote memory tier
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const body = await request.json();
    const { memoryId, newTier } = body;

    if (!memoryId || typeof memoryId !== "string") {
      return NextResponse.json({ error: "memoryId is required" }, { status: 400 });
    }

    // Verify the memoryId belongs to the current user
    const memoryDoc = await adminDb.collection("memories").doc(memoryId).get();
    if (!memoryDoc.exists) {
      return NextResponse.json({ error: "Memory not found or access denied" }, { status: 404 });
    }
    if (memoryDoc.data().userId !== userId) {
      return NextResponse.json({ error: "Memory not found or access denied" }, { status: 404 });
    }

    const validTiers = ["short_term", "long_term", "episodic", "semantic", "procedural"];
    if (!newTier || !validTiers.includes(newTier)) {
      return NextResponse.json({ error: `newTier is required. Must be one of: ${validTiers.join(", ")}` }, { status: 400 });
    }

    // Check if hybrid memory already exists
    const existingSnap = await adminDb
      .collection("hybridMemories")
      .where("memoryId", "==", memoryId)
      .limit(1)
      .get();

    let hybridMemory: Record<string, any>;
    const now = new Date().toISOString();

    if (existingSnap.docs.length > 0) {
      const existingId = existingSnap.docs[0].id;
      await adminDb.collection("hybridMemories").doc(existingId).update({
        memoryTier: newTier,
        lastAccessed: now,
        updatedAt: now,
      });
      hybridMemory = { id: existingId, memoryId, memoryTier: newTier, lastAccessed: now };
    } else {
      const id = generateId();
      await adminDb.collection("hybridMemories").doc(id).set({
        memoryId,
        memoryTier: newTier,
        lastAccessed: now,
        createdAt: now,
        updatedAt: now,
      });
      hybridMemory = { id, memoryId, memoryTier: newTier, lastAccessed: now };
    }

    return NextResponse.json({ data: hybridMemory });
  } catch (error) {
    console.error("[POST /api/hybrid-memory] Error:", error);
    return NextResponse.json({ error: "Failed to update memory tier" }, { status: 500 });
  }
}
