import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/privacy/dashboard — Privacy transparency dashboard data
export async function GET() {
  try {
    const [
      totalMemories,
      sensitiveMemories,
      memoriesByType,
      recentAgentExecutions,
      vaultItemCount,
      recentImports,
    ] = await Promise.all([
      // Total memories stored
      db.memory.count(),

      // Encrypted / sensitive items count
      db.memory.count({ where: { isSensitive: true } }),

      // Memories by type
      db.memory.groupBy({
        by: ["type"],
        _count: { type: true },
      }),

      // Recent AI access log (agent executions)
      db.agentExecution.findMany({
        where: {
          status: { in: ["completed", "failed"] },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          agentType: true,
          status: true,
          model: true,
          createdAt: true,
          duration: true,
          contextSize: true,
        },
      }),

      // Vault items (encrypted storage)
      db.vaultItem.count(),

      // Import configurations (external data sources)
      db.memoryImport.findMany({
        select: {
          id: true,
          source: true,
          status: true,
          itemsImported: true,
          lastSyncAt: true,
        },
      }),
    ]);

    // Compute storage usage estimate
    const allMemories = await db.memory.findMany({
      select: {
        content: true,
        embedding: true,
        metadata: true,
        createdAt: true,
        type: true,
      },
    });

    let totalChars = 0;
    let totalEmbeddingBytes = 0;
    const ageBuckets: Record<string, number> = {
      "today": 0,
      "this_week": 0,
      "this_month": 0,
      "3_months": 0,
      "6_months": 0,
      "older": 0,
    };

    const now = new Date();

    for (const mem of allMemories) {
      totalChars += mem.content.length;
      totalEmbeddingBytes += mem.embedding ? mem.embedding.length : 0;

      // Compute age bucket
      const ageMs = now.getTime() - new Date(mem.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < 1) {
        ageBuckets["today"]++;
      } else if (ageDays < 7) {
        ageBuckets["this_week"]++;
      } else if (ageDays < 30) {
        ageBuckets["this_month"]++;
      } else if (ageDays < 90) {
        ageBuckets["3_months"]++;
      } else if (ageDays < 180) {
        ageBuckets["6_months"]++;
      } else {
        ageBuckets["older"]++;
      }
    }

    const storageEstimate = {
      contentSizeBytes: totalChars * 2, // UTF-16 rough estimate
      embeddingSizeBytes: totalEmbeddingBytes,
      totalEstimateMB: Math.round(((totalChars * 2 + totalEmbeddingBytes) / (1024 * 1024)) * 100) / 100,
    };

    // Format memories by type
    const formattedByType = memoriesByType.map((entry) => ({
      type: entry.type,
      count: entry._count.type,
    }));

    // Format AI access log
    const aiAccessLog = recentAgentExecutions.map((exec) => ({
      id: exec.id,
      agent: exec.agentType,
      status: exec.status,
      model: exec.model || "default",
      timestamp: exec.createdAt,
      durationMs: exec.duration,
      tokensUsed: exec.contextSize,
    }));

    return NextResponse.json({
      data: {
        totalMemories,
        sensitiveItemsCount: sensitiveMemories + vaultItemCount,
        memoriesByType: formattedByType,
        aiAccessLog,
        storage: storageEstimate,
        memoryAgeDistribution: ageBuckets,
        externalSources: recentImports.map((imp) => ({
          source: imp.source,
          status: imp.status,
          itemsImported: imp.itemsImported,
          lastSyncAt: imp.lastSyncAt,
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/privacy/dashboard] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch privacy dashboard data" },
      { status: 500 }
    );
  }
}
