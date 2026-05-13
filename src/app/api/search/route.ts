import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

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
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;
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
    const lowerQuery = query.toLowerCase();

    // Search memories — Firestore doesn't support text search, fetch and filter in JS
    let memoriesQuery = adminDb
      .collection("memories")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50);

    const memoriesSnapshot = await memoriesQuery.get();
    const memories = memoriesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    for (const memory of memories as Array<Record<string, any>>) {
      const searchableText = [
        memory.content,
        memory.summary,
        memory.title,
        memory.tags,
      ]
        .filter(Boolean)
        .join(" ");

      // Apply type and projectId filters in JS
      if (type && memory.type !== type) continue;
      if (projectId && memory.projectId !== projectId) continue;

      const score = calculateScore(searchableText, query, queryTerms);
      if (score > 0) {
        results.push({
          id: memory.id,
          type: "memory",
          title: memory.title || "Untitled Memory",
          content: memory.summary || memory.content,
          score,
          createdAt: memory.createdAt,
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
    const sessionsSnapshot = await adminDb
      .collection("sessions")
      .where("userId", "==", userId)
      .orderBy("startedAt", "desc")
      .limit(20)
      .get();

    const sessions = sessionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    for (const sessionItem of sessions as Array<Record<string, any>>) {
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
          createdAt: sessionItem.startedAt,
          metadata: {
            isActive: sessionItem.isActive,
            project: sessionItem.project,
          },
        });
      }
    }

    // Search timeline events
    const timelineSnapshot = await adminDb
      .collection("timeline")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    const timelineEvents = timelineSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    for (const event of timelineEvents as Array<Record<string, any>>) {
      const searchableText = [event.title, event.domain, event.metadata]
        .filter(Boolean)
        .join(" ");

      if (type && event.type !== type) continue;

      const score = calculateScore(searchableText, query, queryTerms);
      if (score > 0) {
        results.push({
          id: event.id,
          type: "timeline",
          title: event.title,
          content: event.domain || "",
          score,
          createdAt: event.createdAt,
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
    const searchId = generateId();
    await adminDb.collection("searchQueries").doc(searchId).set({
      query: query.trim(),
      results: JSON.stringify(results.slice(0, 20).map((r) => r.id)),
      filters: JSON.stringify({ type, projectId }),
      userId,
      createdAt: new Date().toISOString(),
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
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

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

    // Build Firestore query — filter by userId, apply equality filters, then JS filter text
    let firestoreQuery = adminDb
      .collection("memories")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc");

    if (type && typeof type === "string") {
      firestoreQuery = firestoreQuery.where("type", "==", type);
    }
    if (projectId && typeof projectId === "string") {
      firestoreQuery = firestoreQuery.where("projectId", "==", projectId);
    }
    if (domain && typeof domain === "string") {
      firestoreQuery = firestoreQuery.where("domain", "==", domain);
    }
    if (isSensitive !== undefined) {
      firestoreQuery = firestoreQuery.where("isSensitive", "==", Boolean(isSensitive));
    }

    const fetchLimit = Math.min(100, Math.max(1, limit));
    const snapshot = await firestoreQuery.limit(fetchLimit).get();

    const allMemories = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // JS filtering: text match, array type filter, tags, date range
    const lowerQuery = query.toLowerCase();
    const filtered = allMemories.filter((memory: Record<string, any>) => {
      // Text search
      const searchableText = [
        memory.content,
        memory.summary,
        memory.title,
        memory.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesText = searchableText.includes(lowerQuery) ||
        queryTerms.some((term) => term && searchableText.includes(term.toLowerCase()));

      if (!matchesText) return false;

      // Array type filter
      if (Array.isArray(type)) {
        if (!type.includes(memory.type)) return false;
      }

      // Array projectId filter
      if (Array.isArray(projectId)) {
        if (!projectId.includes(memory.projectId)) return false;
      }

      // Array domain filter
      if (Array.isArray(domain)) {
        if (!domain.includes(memory.domain)) return false;
      }

      // Tag filtering
      if (tags && Array.isArray(tags) && tags.length > 0) {
        const memTags: string[] = [];
        try { memTags.push(...JSON.parse(String(memory.tags || "[]"))); } catch { /* ignore */ }
        if (!tags.some((tag: string) => memTags.includes(tag))) return false;
      }

      // Date range filtering
      if (dateRange) {
        if (dateRange.start) {
          const memDate = new Date(memory.createdAt);
          if (memDate < new Date(dateRange.start)) return false;
        }
        if (dateRange.end) {
          const memDate = new Date(memory.createdAt);
          if (memDate > new Date(dateRange.end)) return false;
        }
      }

      return true;
    });

    const results = filtered
      .map((memory: Record<string, any>) => {
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
          createdAt: memory.createdAt,
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

    // Log the search query
    const searchId = generateId();
    await adminDb.collection("searchQueries").doc(searchId).set({
      query,
      results: JSON.stringify(results.slice(0, 50).map((r) => r.id)),
      filters: JSON.stringify({ type, projectId, domain, tags, dateRange, isSensitive }),
      userId,
      createdAt: new Date().toISOString(),
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
