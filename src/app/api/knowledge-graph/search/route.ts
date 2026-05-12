import { NextRequest, NextResponse } from "next/server";
import {
  searchGraph,
  getCachedGraph,
  buildGraphFromMemories,
} from "@/lib/ai/knowledge-engine";

// GET /api/knowledge-graph/search — Search the knowledge graph
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    let graph = getCachedGraph();
    if (!graph) {
      graph = await buildGraphFromMemories();
    }

    const { nodes, edges } = searchGraph(graph, query);

    return NextResponse.json({
      data: {
        query,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodes,
        edges,
      },
    });
  } catch (error) {
    console.error("[GET /api/knowledge-graph/search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search knowledge graph" },
      { status: 500 }
    );
  }
}
