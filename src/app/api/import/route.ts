import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";

// GET /api/import — List import configurations
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const snapshot = await adminDb
      .collection("memoryImports")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const imports = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ data: imports });
  } catch (error) {
    console.error("[GET /api/import] Error:", error);
    return NextResponse.json({ error: "Failed to fetch import configurations" }, { status: 500 });
  }
}

// POST /api/import — Create new import configuration
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const body = await request.json();
    const { source, sourceId, externalUrl, metadata } = body;

    if (!source || typeof source !== "string") {
      return NextResponse.json({ error: "source is required (e.g., github, notion, slack)" }, { status: 400 });
    }

    const validSources = ["github", "notion", "slack", "linear", "google_docs", "vscode", "discord", "jira", "figma"];
    if (!validSources.includes(source)) {
      return NextResponse.json({ error: `Invalid source. Must be one of: ${validSources.join(", ")}` }, { status: 400 });
    }

    const id = generateId();
    const now = new Date().toISOString();

    await adminDb.collection("memoryImports").doc(id).set({
      source,
      sourceId: sourceId || null,
      externalUrl: externalUrl || null,
      status: "pending",
      metadata: metadata ? JSON.stringify(metadata) : null,
      userId,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      data: { id, source, sourceId: sourceId || null, externalUrl: externalUrl || null, status: "pending", metadata: metadata ? JSON.stringify(metadata) : null, userId, createdAt: now, updatedAt: now },
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/import] Error:", error);
    return NextResponse.json({ error: "Failed to create import configuration" }, { status: 500 });
  }
}
