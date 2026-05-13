import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

// GET /api/memories — List memories with filters, search, and pagination
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
    const type = searchParams.get("type") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const sessionId = searchParams.get("sessionId") || undefined;
    const isSensitiveParam = searchParams.get("isSensitive");
    const query = searchParams.get("q") || undefined;

    // Build Firestore query — always filter by userId first
    let firestoreQuery = adminDb
      .collection("memories")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc");

    // Apply additional equality filters
    if (type) {
      firestoreQuery = firestoreQuery.where("type", "==", type);
    }
    if (projectId) {
      firestoreQuery = firestoreQuery.where("projectId", "==", projectId);
    }
    if (sessionId) {
      firestoreQuery = firestoreQuery.where("sessionId", "==", sessionId);
    }
    if (isSensitiveParam !== null && isSensitiveParam !== undefined && isSensitiveParam !== "") {
      firestoreQuery = firestoreQuery.where("isSensitive", "==", isSensitiveParam === "true");
    }

    // Firestore doesn't support text search — fetch a larger set and filter in JS
    // If no search, apply server-side pagination via cursor
    let memories: Array<Record<string, any>> = [];
    let total = 0;

    if (query) {
      // For search queries, fetch up to a reasonable limit and filter client-side
      const searchLimit = Math.min(200, limit * 3);
      const snapshot = await firestoreQuery.limit(searchLimit).get();
      const allDocs: Array<Record<string, any>> = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data } as Record<string, any>;
      });

      const lowerQuery = query.toLowerCase();
      const filtered = allDocs.filter((doc) => {
        const content = String(doc.content || "").toLowerCase();
        const summary = String(doc.summary || "").toLowerCase();
        const title = String(doc.title || "").toLowerCase();
        const tags = String(doc.tags || "").toLowerCase();
        return (
          content.includes(lowerQuery) ||
          summary.includes(lowerQuery) ||
          title.includes(lowerQuery) ||
          tags.includes(lowerQuery)
        );
      });

      total = filtered.length;
      const start = (page - 1) * limit;
      memories = filtered.slice(start, start + limit);
    } else {
      // No search — get total count and paginate with offset
      // Firestore doesn't have count + offset in one query, so we do two queries
      const countSnapshot = await firestoreQuery
        .select("__name__")
        .get();
      total = countSnapshot.size;

      // For pagination, fetch limit+1 items to determine if there are more pages
      // Firestore doesn't support offset directly, so we use cursor-based pagination
      // For simplicity, fetch all and slice (acceptable for collections <1000)
      const offset = (page - 1) * limit;
      if (offset === 0) {
        const snapshot = await firestoreQuery.limit(limit).get();
        memories = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Record<string, any>),
        }));
      } else {
        // Fetch up to offset+limit and slice
        const snapshot = await firestoreQuery.limit(offset + limit).get();
        memories = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as Record<string, any>),
          }))
          .slice(offset);
      }
    }

    // Parse tags from JSON strings to arrays for the response
    const parsedMemories = memories.map((memory) => {
      let parsedTags: string[] = [];
      try {
        parsedTags = memory.tags ? JSON.parse(String(memory.tags)) : [];
      } catch {
        parsedTags = memory.tags ? [String(memory.tags)] : [];
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
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

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

    const validTypes = ["general", "code", "research", "decision", "reference", "snippet"];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid memory type. Must be one of: general, code, research, decision, reference, snippet" },
        { status: 400 }
      );
    }

    // Auto-generate summary if not provided
    const generatedSummary =
      summary ||
      (content.length > 200 ? content.substring(0, 197) + "..." : content);

    // Serialize tags as JSON string (matching existing schema)
    let serializedTags: string | undefined;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      serializedTags = JSON.stringify(
        tagArray.map((t: string) => String(t).trim()).filter(Boolean)
      );
    }

    // Serialize metadata
    let serializedMetadata: string | undefined;
    if (metadata) {
      serializedMetadata =
        typeof metadata === "string" ? metadata : JSON.stringify(metadata);
    }

    const now = new Date().toISOString();
    const memoryId = generateId();

    const memoryDoc = {
      userId,
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
      metadata: serializedMetadata || null,
      embedding: null,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection("memories").doc(memoryId).set(memoryDoc);

    // Parse tags for the response
    let parsedTags: string[] = [];
    try {
      parsedTags = memoryDoc.tags ? JSON.parse(memoryDoc.tags) : [];
    } catch {
      parsedTags = memoryDoc.tags ? [memoryDoc.tags] : [];
    }

    return NextResponse.json(
      {
        data: {
          id: memoryId,
          ...memoryDoc,
          tags: parsedTags,
          session: null, // Firestore doesn't do joins; populate if needed
        },
      },
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
