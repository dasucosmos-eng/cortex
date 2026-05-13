import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";

// GET /api/privacy/dashboard — Privacy transparency dashboard data
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    // Firestore doesn't support count queries natively — we fetch all and count in JS
    const [
      memoriesSnap,
      agentExecutionsSnap,
      vaultSnap,
      importsSnap,
    ] = await Promise.all([
      adminDb
        .collection("memories")
        .where("userId", "==", userId)
        .get(),
      adminDb
        .collection("agentExecutions")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get(),
      adminDb
        .collection("vault")
        .where("userId", "==", userId)
        .get(),
      adminDb
        .collection("memoryImports")
        .where("userId", "==", userId)
        .get(),
    ]);

    const allMemories = memoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const agentExecutions = agentExecutionsSnap.docs.map((d) => d.data());
    const vaultItems = vaultSnap.docs.map((d) => d.data());
    const imports = importsSnap.docs.map((d) => d.data());

    const totalMemories = allMemories.length;
    const sensitiveMemories = allMemories.filter((m: any) => m.isSensitive === true).length;
    const vaultItemCount = vaultItems.length;

    // Group memories by type
    const memoriesByType: Record<string, number> = {};
    for (const mem of allMemories) {
      const type = (mem as any).type || "unknown";
      memoriesByType[type] = (memoriesByType[type] || 0) + 1;
    }
    const formattedByType = Object.entries(memoriesByType).map(([type, count]) => ({ type, count }));

    // Compute storage estimates
    let totalChars = 0;
    let totalEmbeddingBytes = 0;
    const ageBuckets: Record<string, number> = { "today": 0, "this_week": 0, "this_month": 0, "3_months": 0, "6_months": 0, "older": 0 };
    const now = new Date();

    for (const mem of allMemories) {
      const m = mem as any;
      totalChars += (m.content || "").length;
      totalEmbeddingBytes += m.embedding ? (m.embedding as string).length : 0;
      const ageMs = now.getTime() - new Date(m.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < 1) ageBuckets["today"]++;
      else if (ageDays < 7) ageBuckets["this_week"]++;
      else if (ageDays < 30) ageBuckets["this_month"]++;
      else if (ageDays < 90) ageBuckets["3_months"]++;
      else if (ageDays < 180) ageBuckets["6_months"]++;
      else ageBuckets["older"]++;
    }

    const storageEstimate = {
      contentSizeBytes: totalChars * 2,
      embeddingSizeBytes: totalEmbeddingBytes,
      totalEstimateMB: Math.round(((totalChars * 2 + totalEmbeddingBytes) / (1024 * 1024)) * 100) / 100,
    };

    // Filter agent executions by status
    const recentAgentExecutions = agentExecutions.filter((e: any) =>
      e.status === "completed" || e.status === "failed"
    );

    const aiAccessLog = recentAgentExecutions.map((exec: any) => ({
      id: exec.id, agent: exec.agentType, status: exec.status, model: exec.model || "default",
      timestamp: exec.createdAt, durationMs: exec.duration, tokensUsed: exec.contextSize,
    }));

    return NextResponse.json({
      data: {
        totalMemories,
        sensitiveItemsCount: sensitiveMemories + vaultItemCount,
        memoriesByType: formattedByType,
        aiAccessLog,
        storage: storageEstimate,
        memoryAgeDistribution: ageBuckets,
        externalSources: imports.map((imp: any) => ({
          source: imp.source, status: imp.status, itemsImported: imp.itemsImported || 0, lastSyncAt: imp.lastSyncAt,
        })),
      },
    });
  } catch (error) {
    console.error("[GET /api/privacy/dashboard] Error:", error);
    return NextResponse.json({ error: "Failed to fetch privacy dashboard data" }, { status: 500 });
  }
}
