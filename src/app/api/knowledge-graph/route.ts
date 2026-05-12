import { NextRequest, NextResponse } from "next/server";
import {
  buildGraphFromMemories,
  getCachedGraph,
  invalidateGraphCache,
} from "@/lib/ai/knowledge-engine";

// GET /api/knowledge-graph — Get full knowledge graph
export async function GET() {
  try {
    // Try to use cached graph first
    let graph = getCachedGraph();

    if (!graph) {
      graph = await buildGraphFromMemories();
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
    return NextResponse.json(
      { error: "Failed to retrieve knowledge graph" },
      { status: 500 }
    );
  }
}

// POST /api/knowledge-graph — Trigger graph rebuild from memories
export async function POST() {
  try {
    invalidateGraphCache();
    const graph = await buildGraphFromMemories();

    // Count nodes by type
    const typeCounts: Record<string, number> = {};
    for (const node of graph.nodes) {
      typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    }

    // Count edges by type
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
    return NextResponse.json(
      { error: "Failed to rebuild knowledge graph" },
      { status: 500 }
    );
  }
}
