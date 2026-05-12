import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/sync — Get sync status for current device
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId query parameter is required" },
        { status: 400 }
      );
    }

    const syncState = await db.syncState.findUnique({
      where: { deviceId },
    });

    if (!syncState) {
      return NextResponse.json({
        data: {
          deviceId,
          status: "unknown",
          syncVersion: 0,
          lastSyncAt: null,
          pendingOps: 0,
        },
      });
    }

    return NextResponse.json({
      data: {
        deviceId: syncState.deviceId,
        deviceName: syncState.deviceName,
        status: syncState.status,
        syncVersion: syncState.syncVersion,
        lastSyncAt: syncState.lastSyncAt,
        pendingOps: syncState.pendingOps,
      },
    });
  } catch (error) {
    console.error("[GET /api/sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}

// POST /api/sync — Register device for sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, deviceName } = body;

    if (!deviceId || typeof deviceId !== "string") {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    if (!deviceName || typeof deviceName !== "string") {
      return NextResponse.json(
        { error: "deviceName is required" },
        { status: 400 }
      );
    }

    const syncState = await db.syncState.upsert({
      where: { deviceId },
      create: {
        deviceId,
        deviceName,
        status: "synced",
        syncVersion: 0,
        pendingOps: 0,
        lastSyncAt: new Date(),
      },
      update: {
        deviceName,
        status: "synced",
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({ data: syncState }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to register device for sync" },
      { status: 500 }
    );
  }
}

// PUT /api/sync — Trigger sync with incoming changes
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, syncVersion, changes } = body;

    if (!deviceId || typeof deviceId !== "string") {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    if (typeof syncVersion !== "number") {
      return NextResponse.json(
        { error: "syncVersion is required and must be a number" },
        { status: 400 }
      );
    }

    // Verify device exists
    const existingState = await db.syncState.findUnique({
      where: { deviceId },
    });

    if (!existingState) {
      return NextResponse.json(
        { error: "Device not registered. Please register first via POST." },
        { status: 404 }
      );
    }

    // Check for conflicts
    if (syncVersion < existingState.syncVersion) {
      return NextResponse.json(
        {
          error: "Sync conflict detected. Please pull latest state before pushing changes.",
          serverVersion: existingState.syncVersion,
          clientVersion: syncVersion,
        },
        { status: 409 }
      );
    }

    // Process incoming changes
    const processedChanges: Array<{
      type: string;
      id: string;
      status: string;
    }> = [];

    if (Array.isArray(changes) && changes.length > 0) {
      for (const change of changes) {
        const { type, data } = change;
        processedChanges.push({
          type: type || "unknown",
          id: data?.id || "unknown",
          status: "processed",
        });
      }
    }

    // Update sync state
    const newVersion = Math.max(existingState.syncVersion, syncVersion) + 1;
    const updatedState = await db.syncState.update({
      where: { deviceId },
      data: {
        syncVersion: newVersion,
        status: "synced",
        lastSyncAt: new Date(),
        pendingOps: 0,
      },
    });

    return NextResponse.json({
      data: {
        syncVersion: updatedState.syncVersion,
        status: updatedState.status,
        lastSyncAt: updatedState.lastSyncAt,
        changesProcessed: processedChanges.length,
        details: processedChanges,
      },
    });
  } catch (error) {
    console.error("[PUT /api/sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
