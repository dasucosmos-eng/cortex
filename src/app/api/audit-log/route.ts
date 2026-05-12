import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/audit-log — List audit logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const organizationId = searchParams.get("organizationId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const where: Record<string, unknown> = {};

    if (action) {
      where.action = action;
    }
    if (userId) {
      where.userId = userId;
    }
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const [auditLogs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    // Enrich logs with parsed details
    const enrichedLogs = auditLogs.map((log) => {
      let parsedDetails: Record<string, unknown> = {};
      try {
        parsedDetails = log.details ? JSON.parse(log.details) : {};
      } catch {
        parsedDetails = {};
      }

      return {
        id: log.id,
        userId: log.userId,
        organizationId: log.organizationId,
        organization: log.organization,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        details: parsedDetails,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      };
    });

    return NextResponse.json({
      data: enrichedLogs,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[GET /api/audit-log] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
