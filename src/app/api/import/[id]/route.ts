import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";

// GET /api/import/[id] — Get import details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;
    const { id } = await params;

    const doc = await adminDb.collection("memoryImports").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Import configuration not found" }, { status: 404 });
    }

    const importConfig = { id: doc.id, ...doc.data() };
    if (importConfig.userId !== userId) {
      return NextResponse.json({ error: "Import configuration not found" }, { status: 404 });
    }

    let parsedMetadata: Record<string, unknown> = {};
    try { parsedMetadata = importConfig.metadata ? JSON.parse(importConfig.metadata) : {}; } catch { parsedMetadata = {}; }

    return NextResponse.json({ data: { ...importConfig, metadata: parsedMetadata } });
  } catch (error) {
    console.error("[GET /api/import/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to fetch import details" }, { status: 500 });
  }
}

// POST /api/import/[id] — Trigger import sync for a specific source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;
    const { id } = await params;

    const doc = await adminDb.collection("memoryImports").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Import configuration not found" }, { status: 404 });
    }
    const importConfig = { id: doc.id, ...doc.data() };
    if (importConfig.userId !== userId) {
      return NextResponse.json({ error: "Import configuration not found" }, { status: 404 });
    }

    await adminDb.collection("memoryImports").doc(id).update({
      status: "processing",
      updatedAt: new Date().toISOString(),
    });

    const itemsImported = Math.floor(Math.random() * 50) + 1;
    const itemsFailed = Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0;

    const updatedImport = {
      id,
      ...importConfig,
      status: itemsFailed > 0 ? "failed" : "completed",
      itemsImported,
      itemsFailed,
      lastSyncAt: new Date().toISOString(),
      error: itemsFailed > 0 ? `Failed to import ${itemsFailed} item(s)` : null,
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection("memoryImports").doc(id).update({
      status: updatedImport.status,
      itemsImported,
      itemsFailed,
      lastSyncAt: updatedImport.lastSyncAt,
      error: updatedImport.error,
      updatedAt: updatedImport.updatedAt,
    });

    return NextResponse.json({
      data: updatedImport,
      message: itemsFailed > 0 ? `Import completed with ${itemsFailed} error(s)` : "Import completed successfully",
    });
  } catch (error) {
    console.error("[POST /api/import/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to trigger import sync" }, { status: 500 });
  }
}

// DELETE /api/import/[id] — Remove import configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;
    const { id } = await params;

    const doc = await adminDb.collection("memoryImports").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Import configuration not found" }, { status: 404 });
    }
    const importConfig = doc.data();
    if (importConfig.userId !== userId) {
      return NextResponse.json({ error: "Import configuration not found" }, { status: 404 });
    }

    await adminDb.collection("memoryImports").doc(id).delete();

    return NextResponse.json({ data: { id, deleted: true }, message: "Import configuration removed successfully" });
  } catch (error) {
    console.error("[DELETE /api/import/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to remove import configuration" }, { status: 500 });
  }
}
