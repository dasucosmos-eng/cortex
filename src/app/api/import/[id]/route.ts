import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/import/[id] — Get import details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const importConfig = await db.memoryImport.findUnique({
      where: { id },
    });

    if (!importConfig) {
      return NextResponse.json(
        { error: "Import configuration not found" },
        { status: 404 }
      );
    }

    let parsedMetadata: Record<string, unknown> = {};
    try {
      parsedMetadata = importConfig.metadata
        ? JSON.parse(importConfig.metadata)
        : {};
    } catch {
      parsedMetadata = {};
    }

    return NextResponse.json({
      data: {
        ...importConfig,
        metadata: parsedMetadata,
      },
    });
  } catch (error) {
    console.error("[GET /api/import/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch import details" },
      { status: 500 }
    );
  }
}

// POST /api/import/[id] — Trigger import sync for a specific source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const importConfig = await db.memoryImport.findUnique({
      where: { id },
    });

    if (!importConfig) {
      return NextResponse.json(
        { error: "Import configuration not found" },
        { status: 404 }
      );
    }

    // Update status to processing
    await db.memoryImport.update({
      where: { id },
      data: {
        status: "processing",
      },
    });

    // Simulate async import processing
    // In production, this would trigger a background job/queue
    const itemsImported = Math.floor(Math.random() * 50) + 1;
    const itemsFailed = Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0;

    const updatedImport = await db.memoryImport.update({
      where: { id },
      data: {
        status: itemsFailed > 0 ? "failed" : "completed",
        itemsImported,
        itemsFailed,
        lastSyncAt: new Date(),
        error:
          itemsFailed > 0
            ? `Failed to import ${itemsFailed} item(s)`
            : null,
      },
    });

    return NextResponse.json({
      data: updatedImport,
      message:
        itemsFailed > 0
          ? `Import completed with ${itemsFailed} error(s)`
          : "Import completed successfully",
    });
  } catch (error) {
    console.error("[POST /api/import/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger import sync" },
      { status: 500 }
    );
  }
}

// DELETE /api/import/[id] — Remove import configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const importConfig = await db.memoryImport.findUnique({
      where: { id },
    });

    if (!importConfig) {
      return NextResponse.json(
        { error: "Import configuration not found" },
        { status: 404 }
      );
    }

    await db.memoryImport.delete({
      where: { id },
    });

    return NextResponse.json({
      data: { id, deleted: true },
      message: "Import configuration removed successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/import/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to remove import configuration" },
      { status: 500 }
    );
  }
}
