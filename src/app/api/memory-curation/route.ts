import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/memory-curation — Run memory curation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, options } = body;

    const validActions = ["detect_duplicates", "compress", "archive", "rebuild_hierarchy"];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }, { status: 400 });
    }

    const result: Record<string, unknown> = { action, processedAt: new Date().toISOString() };
    const userId = session.user.id;

    switch (action) {
      case "detect_duplicates": {
        const memories = await db.memory.findMany({
          where: { userId },
          select: { id: true, content: true, title: true, type: true },
          orderBy: { createdAt: "desc" },
          take: 500,
        });

        const duplicates: Array<{ group: number; memoryIds: string[]; similarity: string; titles: string[] }> = [];
        let groupIndex = 0;

        for (let i = 0; i < memories.length; i++) {
          const contentA = memories[i].content.substring(0, 100).toLowerCase();
          const titleA = (memories[i].title || "").toLowerCase();
          if (contentA.length < 10) continue;

          for (let j = i + 1; j < memories.length; j++) {
            const contentB = memories[j].content.substring(0, 100).toLowerCase();
            const titleB = (memories[j].title || "").toLowerCase();

            if (
              contentA === contentB ||
              (contentA.length > 20 && contentB.includes(contentA.substring(0, 80))) ||
              (titleA && titleB && titleA === titleB && titleA.length > 5)
            ) {
              const existingGroup = duplicates.find((d) => d.memoryIds.includes(memories[i].id));
              if (existingGroup) {
                if (!existingGroup.memoryIds.includes(memories[j].id)) {
                  existingGroup.memoryIds.push(memories[j].id);
                  existingGroup.titles.push(memories[j].title || "Untitled");
                }
              } else {
                groupIndex++;
                duplicates.push({
                  group: groupIndex,
                  memoryIds: [memories[i].id, memories[j].id],
                  similarity: "high",
                  titles: [memories[i].title || "Untitled", memories[j].title || "Untitled"],
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

        const oldMemories = await db.memory.findMany({
          where: { userId, createdAt: { lt: thresholdDate }, isSensitive: false },
          orderBy: { createdAt: "asc" },
          take: options?.limit || 100,
        });

        let compressedCount = 0;
        for (const mem of oldMemories) {
          if (mem.content.length > 500) {
            await db.memory.update({ where: { id: mem.id }, data: { summary: mem.summary || mem.content.substring(0, 200) + "..." } });
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

        // Get user's memory IDs for ownership check
        const userMemoryIds = await db.memory.findMany({
          where: { userId },
          select: { id: true },
        });
        const memoryIdList = userMemoryIds.map((m) => m.id);

        // Archive hybrid memories linked to user's memories
        const hybridMemories = await db.hybridMemory.findMany({
          where: {
            OR: [
              ...(memoryIdList.length > 0 ? [{ memoryId: { in: memoryIdList } }] : []),
              ...(memoryIdList.length === 0 ? [{ id: "never-match" }] : []),
            ],
            lastAccessed: { lt: archiveThresholdDate },
            isArchived: false,
          },
          orderBy: { lastAccessed: "asc" },
          take: options?.limit || 100,
        });

        let archivedCount = 0;
        if (hybridMemories.length > 0) {
          const idsToArchive = hybridMemories.map((hm) => hm.id);
          await db.hybridMemory.updateMany({ where: { id: { in: idsToArchive } }, data: { isArchived: true } });
          archivedCount = idsToArchive.length;
        }
        result.itemsScanned = hybridMemories.length;
        result.itemsArchived = archivedCount;
        break;
      }

      case "rebuild_hierarchy": {
        // Get user's memory IDs for ownership filtering
        const userMemoryIds = await db.memory.findMany({
          where: { userId },
          select: { id: true },
        });
        const memoryIdList = userMemoryIds.map((m) => m.id);

        const relationWhere: Record<string, unknown> = {};
        if (memoryIdList.length > 0) {
          relationWhere.OR = [
            { fromId: { in: memoryIdList } },
            { toId: { in: memoryIdList } },
          ];
        } else {
          relationWhere.id = "never-match";
        }

        const memoryRelations = await db.memoryRelation.findMany({
          where: relationWhere,
          include: {
            from: { select: { id: true, type: true, tags: true, projectId: true } },
            to: { select: { id: true, type: true, tags: true, projectId: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        });

        const hierarchyStats = { totalRelations: memoryRelations.length, byType: {} as Record<string, number>, byStrength: { strong: 0, medium: 0, weak: 0 } };
        for (const rel of memoryRelations) {
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
