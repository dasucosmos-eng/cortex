import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/import — List import configurations
export async function GET() {
  try {
    const imports = await db.memoryImport.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: imports });
  } catch (error) {
    console.error("[GET /api/import] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch import configurations" },
      { status: 500 }
    );
  }
}

// POST /api/import — Create new import configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, sourceId, externalUrl, metadata } = body;

    if (!source || typeof source !== "string") {
      return NextResponse.json(
        { error: "source is required (e.g., github, notion, slack)" },
        { status: 400 }
      );
    }

    const validSources = [
      "github",
      "notion",
      "slack",
      "linear",
      "google_docs",
      "vscode",
      "discord",
      "jira",
      "figma",
    ];

    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(", ")}` },
        { status: 400 }
      );
    }

    const importConfig = await db.memoryImport.create({
      data: {
        source,
        sourceId: sourceId || null,
        externalUrl: externalUrl || null,
        status: "pending",
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({ data: importConfig }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/import] Error:", error);
    return NextResponse.json(
      { error: "Failed to create import configuration" },
      { status: 500 }
    );
  }
}
