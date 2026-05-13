import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";

// POST /api/memory-curation — Run memory curation
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const body = await request.json();
    const { action, options } = body;

    const validActions = ["detect_duplicates", "compress", "archive", "rebuild_hierarchy"];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }, { status: 400 });
    }

    const result: Record<string, unknown> = { action, processedAt: new Date().toISOString() };

    switch (action) {
      case "detect_duplicates": {
        const memoriesSnap = await adminDb
          .collection("memories")
          .where("userId", "==", userId)
          .orderBy("createdAt", "desc")
          .limit(500)
          .get();

        const memories = memoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const duplicates: Array<{ group: number; memoryIds: string[]; similarity: string; titles: string[] }> = [];
        let groupIndex = 0;

        for (let i = 0; i < memories.length; i++) {
          const contentA = (memories[i] as any).content.substring(0, 100).toLowerCase();
          const titleA = ((memories[i] as any).title || "").toLowerCase();
          if (contentA.length < 10) continue;

          for (let j = i + 1; j < memories.length; j++) {
            const contentB = (memories[j] as any).content.substring(0, 100).toLowerCase();
            const titleB = ((memories[j] as any).title || "").toLowerCase();

            if (
              contentA === contentB ||
              (contentA.length > 20 && contentB.includes(contentA.substring(0, 80))) ||
              (titleA && titleB && titleA === titleB && titleA.length > 5)
            ) {
              const existingGroup = duplicates.find((d) => d.memoryIds.includes(memories[i].id));
              if (existingGroup) {
                if (!existingGroup.memoryIds.includes(memories[j].id)) {
                  existingGroup.memoryIds.push(memories[j].id);
                  existingGroup.titles.push((memories[j] as any).title || "Untitled");
                }
              } else {
                groupIndex++;
                duplicates.push({
                  group: groupIndex,
                  memoryIds: [memories[i].id, memories[j].id],
                  similarity: "high",
                  titles: [(memories[i] as any).title || "Untitled", (memories[j] as any).title || "Untitled"],
                });
              }
            }
          }
        }

        result.duplicatesFound = duplicates.length;
        result.duplicateGroups = duplicates;
        break;
      }

      case "compress": {
        const thresholdDays = options?.thresholdDays || 90;
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);
        const thresholdMs = thresholdDate.getTime();

        const memoriesSnap = await adminDb
          .collection("memories")
          .where("userId", "==", userId)
          .where("isSensitive", "==", false)
          .orderBy("createdAt", "asc")
          .limit(options?.limit || 100)
          .get();

        const oldMemories = memoriesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m: any) => new Date(m.createdAt).getTime() < thresholdMs);

        let compressedCount = 0;
        for (const mem of oldMemories) {
          const m = mem as any;
          if (m.content.length > 500) {
            await adminDb.collection("memories").doc(mem.id).update({
              summary: m.summary || m.content.substring(0, 200) + "...",
              updatedAt: new Date().toISOString(),
            });
            compressedCount++;
          }
        }
        result.memoriesScanned = oldMemories.length;
        result.memoriesCompressed = compressedCount;
        break;
      }

      case "archive": {
        const archiveThresholdDays = options?.thresholdDays || 180;
        const archiveThresholdDate = new Date();
        archiveThresholdDate.setDate(archiveThresholdDate.getDate() - archiveThresholdDays);
        const thresholdMs = archiveThresholdDate.getTime();

        // Get user's memory IDs for ownership check
        const userMemoriesSnap = await adminDb
          .collection("memories")
          .where("userId", "==", userId)
          .select("__name__")
          .get();
        const memoryIdSet = new Set(userMemoriesSnap.docs.map((d) => d.id));

        // Fetch hybrid memories and filter by ownership + threshold
        const hybridSnap = await adminDb
          .collection("hybridMemories")
          .orderBy("lastAccessed", "asc")
          .limit(options?.limit || 100)
          .get();

        const hybridMemories = hybridSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((hm: any) =>
            memoryIdSet.has(hm.memoryId) &&
            !hm.isArchived &&
            new Date(hm.lastAccessed).getTime() < thresholdMs
          );

        let archivedCount = 0;
        if (hybridMemories.length > 0) {
          const batch = adminDb.batch();
          for (const hm of hybridMemories) {
            batch.update(adminDb.collection("hybridMemories").doc(hm.id), {
              isArchived: true,
              updatedAt: new Date().toISOString(),
            });
            archivedCount++;
          }
          await batch.commit();
        }
        result.itemsScanned = hybridMemories.length;
        result.itemsArchived = archivedCount;
        break;
      }

      case "rebuild_hierarchy": {
        // Get user's memory IDs for ownership filtering
        const userMemoriesSnap = await adminDb
          .collection("memories")
          .where("userId", "==", userId)
          .select("__name__")
          .get();
        const memoryIdSet = new Set(userMemoriesSnap.docs.map((d) => d.id));

        // Fetch memory relations
        const relationsSnap = await adminDb
          .collection("memoryRelations")
          .orderBy("createdAt", "desc")
          .limit(500)
          .get();

        const memoryRelations = relationsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((rel: any) => memoryIdSet.has(rel.fromId) || memoryIdSet.has(rel.toId));

        const hierarchyStats = { totalRelations: memoryRelations.length, byType: {} as Record<string, number>, byStrength: { strong: 0, medium: 0, weak: 0 } };
        for (const rel of memoryRelations as any[]) {
          hierarchyStats.byType[rel.type] = (hierarchyStats.byType[rel.type] || 0) + 1;
          if (rel.strength >= 0.7) hierarchyStats.byStrength.strong++;
          else if (rel.strength >= 0.4) hierarchyStats.byStrength.medium++;
          else hierarchyStats.byStrength.weak++;
        }

        result.hierarchyRebuilt = true;
        result.stats = hierarchyStats;
        break;
      }
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[POST /api/memory-curation] Error:", error);
    return NextResponse.json({ error: "Memory curation failed" }, { status: 500 });
  }
}
