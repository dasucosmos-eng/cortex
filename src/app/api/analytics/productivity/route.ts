import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/analytics/productivity — Get productivity insights for a date range
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = { userId: session.user.id };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = startDate;
      if (endDate) (where.date as Record<string, unknown>).lte = endDate;
    }

    if (type) {
      where.type = type;
    }

    const insights = await db.productivityInsight.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    let totalDeepWorkHours = 0;
    let contextSwitches = 0;
    let distractionCount = 0;
    let productivityScores: number[] = [];

    for (const insight of insights) {
      let metric: { value?: number; unit?: string } | null = null;
      try {
        metric = insight.metric ? JSON.parse(insight.metric) : null;
      } catch {
        metric = null;
      }

      if (insight.type === "deep_work" && metric?.value) {
        totalDeepWorkHours += metric.unit === "minutes" ? metric.value / 60 : metric.value;
      }

      if (insight.type === "context_switch" && metric?.value) {
        contextSwitches += metric.value;
      }

      if (insight.type === "distraction" && metric?.value) {
        distractionCount += metric.value;
      }

      if (insight.type === "productive_pattern" && metric?.value && metric.unit === "score") {
        productivityScores.push(metric.value);
      }
    }

    const avgProductivityScore =
      productivityScores.length > 0
        ? productivityScores.reduce((a, b) => a + b, 0) / productivityScores.length
        : 0;

    return NextResponse.json({
      data: insights,
      summary: {
        totalInsights: insights.length,
        totalDeepWorkHours: Math.round(totalDeepWorkHours * 100) / 100,
        contextSwitches,
        distractionCount,
        avgProductivityScore: Math.round(avgProductivityScore * 100) / 100,
        dateRange: { startDate, endDate },
      },
    });
  } catch (error) {
    console.error("[GET /api/analytics/productivity] Error:", error);
    return NextResponse.json({ error: "Failed to fetch productivity insights" }, { status: 500 });
  }
}

// POST /api/analytics/productivity — Generate new productivity insights
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { date, type, title, description, metric, action } = body;

    if (!date || typeof date !== "string") {
      return NextResponse.json(
        { error: "date is required and must be a YYYY-MM-DD string" },
        { status: 400 }
      );
    }

    if (!type || typeof type !== "string") {
      return NextResponse.json(
        { error: "type is required. Must be one of: deep_work, distraction, context_switch, productive_pattern, inefficiency, suggestion" },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const validTypes = ["deep_work", "distraction", "context_switch", "productive_pattern", "inefficiency", "suggestion"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const insight = await db.productivityInsight.create({
      data: {
        date,
        type,
        title,
        description: description || null,
        metric: metric ? JSON.stringify(metric) : null,
        action: action || null,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ data: insight }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/analytics/productivity] Error:", error);
    return NextResponse.json({ error: "Failed to create productivity insight" }, { status: 500 });
  }
}
