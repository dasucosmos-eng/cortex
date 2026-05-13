import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";
import { generateId } from "@/lib/db";
import { FieldValue } from "firebase-admin/firestore";

// Sync change item from client
interface SyncChange {
  type: "memory" | "session" | "timeline";
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
}

// GET /api/sync — Get sync status for current device
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId query parameter is required" },
        { status: 400 }
      );
    }

    // Sync state documents are keyed as {userId}_{deviceId}
    const syncDocId = `${userId}_${deviceId}`;
    const syncDoc = await adminDb
      .collection("syncState")
      .doc(syncDocId)
      .get();

    if (!syncDoc.exists) {
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

    const syncData = syncDoc.data();
    if (!syncData) {
      return NextResponse.json({ error: "Sync data not found" }, { status: 404 });
    }
    // Ensure the requesting user owns this device
    if (syncData.userId && syncData.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      data: {
        deviceId: syncData.deviceId,
        deviceName: syncData.deviceName || null,
        status: syncData.status || "synced",
        syncVersion: syncData.syncVersion || 0,
        lastSyncAt: syncData.lastSyncAt || null,
        pendingOps: syncData.pendingOps || 0,
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
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

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

    const now = new Date().toISOString();
    const syncDocId = `${userId}_${deviceId}`;

    // Create or update the sync state document
    await adminDb.collection("syncState").doc(syncDocId).set(
      {
        userId,
        deviceId,
        deviceName,
        status: "synced",
        syncVersion: 0,
        pendingOps: 0,
        lastSyncAt: now,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json(
      {
        data: {
          deviceId,
          deviceName,
          status: "synced",
          syncVersion: 0,
          pendingOps: 0,
          lastSyncAt: now,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to register device for sync" },
      { status: 500 }
    );
  }
}

// PUT /api/sync — Receive changes from client, ACTUALLY persist them to Firestore
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.uid;

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

    // Verify device is registered
    const syncDocId = `${userId}_${deviceId}`;
    const syncDoc = await adminDb
      .collection("syncState")
      .doc(syncDocId)
      .get();

    if (!syncDoc.exists) {
      return NextResponse.json(
        { error: "Device not registered. Please register first via POST." },
        { status: 404 }
      );
    }

    const syncData = syncDoc.data();
    if (!syncData) {
      return NextResponse.json({ error: "Sync data not found" }, { status: 404 });
    }
    if (syncData.userId && syncData.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentVersion = syncData.syncVersion || 0;

    // Detect sync conflict
    if (syncVersion < currentVersion) {
      return NextResponse.json(
        {
          error: "Sync conflict detected.",
          serverVersion: currentVersion,
          clientVersion: syncVersion,
        },
        { status: 409 }
      );
    }

    // ───────────────────────────────────────────────────────────
    // CRITICAL: Actually persist each change to Firestore
    // ───────────────────────────────────────────────────────────
    const processedChanges: Array<{
      type: string;
      id: string;
      status: string;
      error?: string;
    }> = [];
    let changesProcessed = 0;
    let changesFailed = 0;

    if (Array.isArray(changes) && changes.length > 0) {
      // Process changes in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 500;
      for (let batchIdx = 0; batchIdx < changes.length; batchIdx += BATCH_SIZE) {
        const batch = adminDb.batch();
        const batchChanges = changes.slice(batchIdx, batchIdx + BATCH_SIZE);

        for (const change of batchChanges) {
          if (!change.type || !change.data) {
            processedChanges.push({
              type: change.type || "unknown",
              id: String(change.data?.id || "unknown"),
              status: "skipped",
              error: "Missing type or data",
            });
            continue;
          }

          try {
            const action = change.action || "create";
            const now = new Date().toISOString();

            if (change.type === "memory") {
              await processChange("memories", change, action, userId, now, batch);
              changesProcessed++;
              processedChanges.push({
                type: "memory",
                id: String(change.data.id || "generated"),
                status: "processed",
              });
            } else if (change.type === "session") {
              await processChange("sessions", change, action, userId, now, batch);
              changesProcessed++;
              processedChanges.push({
                type: "session",
                id: String(change.data.id || "generated"),
                status: "processed",
              });
            } else if (change.type === "timeline") {
              await processChange("timeline", change, action, userId, now, batch);
              changesProcessed++;
              processedChanges.push({
                type: "timeline",
                id: String(change.data.id || "generated"),
                status: "processed",
              });
            } else {
              processedChanges.push({
                type: change.type,
                id: String(change.data.id || "unknown"),
                status: "skipped",
                error: `Unknown change type: ${change.type}`,
              });
            }
          } catch (err) {
            changesFailed++;
            processedChanges.push({
              type: change.type,
              id: String(change.data?.id || "unknown"),
              status: "failed",
              error: String(err),
            });
          }
        }

        // Commit the batch
        if (batchChanges.length > 0) {
          await batch.commit();
        }
      }
    }

    // Update sync state
    const newVersion = Math.max(currentVersion, syncVersion) + 1;
    const now = new Date().toISOString();

    await adminDb.collection("syncState").doc(syncDocId).update({
      syncVersion: newVersion,
      status: "synced",
      lastSyncAt: now,
      pendingOps: 0,
      updatedAt: now,
    });

    // ───────────────────────────────────────────────────────────
    // Return server-side changes that the client may not have
    // ───────────────────────────────────────────────────────────
    const serverChanges = await getServerChanges(userId, syncData.lastSyncAt, now);

    return NextResponse.json({
      data: {
        syncVersion: newVersion,
        status: "synced",
        lastSyncAt: now,
        changesProcessed,
        changesFailed,
        details: processedChanges,
        serverChanges,
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

// ─────────────────────────────────────────────────────────────
// Helper: Process a single change and add to Firestore batch
// ─────────────────────────────────────────────────────────────
async function processChange(
  collectionName: string,
  change: SyncChange,
  action: string,
  userId: string,
  now: string,
  batch: FirebaseFirestore.WriteBatch
): Promise<void> {
  const collection = adminDb.collection(collectionName);
  const docId = change.data.id ? String(change.data.id) : generateId();
  const ref = collection.doc(docId);

  // Remove internal fields from the incoming data
  const { id: _id, ...cleanData } = change.data;

  if (action === "delete") {
    // For deletes, only remove docs that belong to this user
    const existingDoc = await ref.get();
    if (existingDoc.exists && existingDoc.get("userId") === userId) {
      batch.delete(ref);
    }
    return;
  }

  // Build the document data with userId always set
  const docData: Record<string, any> = {
    ...cleanData,
    userId,
    updatedAt: now,
  };

  if (action === "create") {
    // For creates, set createdAt if not provided
    if (!docData.createdAt) {
      docData.createdAt = now;
    }
    batch.set(ref, docData, { merge: true });
  } else if (action === "update") {
    // For updates, merge to preserve existing fields
    batch.set(ref, docData, { merge: true });
  } else {
    // Default: upsert (create or update)
    if (!docData.createdAt) {
      docData.createdAt = now;
    }
    batch.set(ref, docData, { merge: true });
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: Get server-side changes that happened since last sync
// ─────────────────────────────────────────────────────────────
async function getServerChanges(
  userId: string,
  lastSyncAt: string | null | undefined,
  now: string
): Promise<Array<{ type: string; action: string; data: Record<string, unknown> }>> {
  if (!lastSyncAt) return [];

  const serverChanges: Array<{ type: string; action: string; data: Record<string, unknown> }> = [];

  // Query each collection for documents updated since lastSyncAt
  const collections = ["memories", "sessions", "timeline"] as const;

  for (const collName of collections) {
    try {
      // Use a composite query: userId + updatedAt > lastSyncAt
      // Note: Requires a composite index on (userId, updatedAt)
      const snapshot = await adminDb
        .collection(collName)
        .where("userId", "==", userId)
        .where("updatedAt", ">", lastSyncAt)
        .orderBy("updatedAt", "asc")
        .limit(100)
        .get();

      for (const doc of snapshot.docs) {
        serverChanges.push({
          type: collName === "memories" ? "memory" : collName === "sessions" ? "session" : "timeline",
          action: "update",
          data: {
            id: doc.id,
            ...doc.data(),
          },
        });
      }
    } catch (err) {
      // If composite index doesn't exist yet, fall back to fetching and filtering in JS
      console.warn(`[sync] Composite index may be missing for ${collName}, falling back to JS filter:`, err);

      try {
        const snapshot = await adminDb
          .collection(collName)
          .where("userId", "==", userId)
          .orderBy("updatedAt", "desc")
          .limit(200)
          .get();

        for (const doc of snapshot.docs) {
          const updatedAt = doc.get("updatedAt") as string;
          if (updatedAt && updatedAt > lastSyncAt) {
            serverChanges.push({
              type: collName === "memories" ? "memory" : collName === "sessions" ? "session" : "timeline",
              action: "update",
              data: {
                id: doc.id,
                ...doc.data(),
              },
            });
          }
        }
      } catch (fallbackErr) {
        console.error(`[sync] Failed to fetch ${collName} for server changes:`, fallbackErr);
      }
    }
  }

  return serverChanges;
}
