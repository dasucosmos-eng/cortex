import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase";

// GET /api/audit-log — List audit logs
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.uid;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const organizationId = searchParams.get("organizationId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    // Build base query — always filter by userId
    let query = adminDb
      .collection("auditLog")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc");

    if (action) {
      query = query.where("action", "==", action);
    }
    if (organizationId) {
      query = query.where("organizationId", "==", organizationId);
    }

    // Fetch a larger set to account for JS filtering on date ranges
    const snapshot = await query.limit(offset + limit + 500).get();

    let logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Apply date range filters in JS
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      logs = logs.filter((l: any) => new Date(l.createdAt).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      logs = logs.filter((l: any) => new Date(l.createdAt).getTime() <= endMs);
    }

    const total = logs.length;
    const paginatedLogs = logs.slice(offset, offset + limit);

    // Enrich with organization data
    const enrichedLogs = await Promise.all(paginatedLogs.map(async (log: any) => {
      let parsedDetails: Record<string, unknown> = {};
      try { parsedDetails = log.details ? JSON.parse(log.details) : {}; } catch { parsedDetails = {}; }

      let organization: { id: string; name: string; slug: string } | null = null;
      if (log.organizationId) {
        const orgDoc = await adminDb.collection("organizations").doc(log.organizationId).get();
        if (orgDoc.exists) {
          const orgData = orgDoc.data();
          organization = { id: orgDoc.id, name: orgData.name, slug: orgData.slug };
        }
      }

      return {
        id: log.id,
        userId: log.userId,
        organizationId: log.organizationId,
        organization,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        details: parsedDetails,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      };
    }));

    return NextResponse.json({
      data: enrichedLogs,
      pagination: { offset, limit, total, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error("[GET /api/audit-log] Error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
