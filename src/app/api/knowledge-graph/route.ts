import { NextRequest, NextResponse } from "next/server";
import {
  buildGraphFromMemories,
  getCachedGraph,
  invalidateGraphCache,
} from "@/lib/ai/knowledge-engine";
import { auth } from "@/lib/auth";

// GET /api/knowledge-graph — Get full knowledge graph
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    let graph = getCachedGraph();

    if (!graph) {
      graph = await buildGraphFromMemories(userId);
    }

    return NextResponse.json({
      data: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        nodes: graph.nodes.slice(0, 200),
        edges: graph.edges.slice(0, 500),
      },
    });
  } catch (error) {
    console.error("[GET /api/knowledge-graph] Error:", error);
    return NextResponse.json({ error: "Failed to retrieve knowledge graph" }, { status: 500 });
  }
}

// POST /api/knowledge-graph — Trigger graph rebuild from memories
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    invalidateGraphCache();
    const graph = await buildGraphFromMemories(userId);

    const typeCounts: Record<string, number> = {};
    for (const node of graph.nodes) {
      typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    }

    const edgeTypeCounts: Record<string, number> = {};
    for (const edge of graph.edges) {
      edgeTypeCounts[edge.type] = (edgeTypeCounts[edge.type] || 0) + 1;
    }

    return NextResponse.json({
      data: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        nodeTypes: typeCounts,
        edgeTypes: edgeTypeCounts,
        nodes: graph.nodes.slice(0, 200),
        edges: graph.edges.slice(0, 500),
      },
    });
  } catch (error) {
    console.error("[POST /api/knowledge-graph] Error:", error);
    return NextResponse.json({ error: "Failed to rebuild knowledge graph" }, { status: 500 });
  }
}
