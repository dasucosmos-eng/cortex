import { NextRequest, NextResponse } from "next/server";
import {
  searchGraph,
  getCachedGraph,
  buildGraphFromMemories,
} from "@/lib/ai/knowledge-engine";
import { auth } from "@/lib/auth";

// GET /api/knowledge-graph/search — Search the knowledge graph
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }

    let graph = getCachedGraph();
    if (!graph) {
      graph = await buildGraphFromMemories(userId);
    }

    const { nodes, edges } = searchGraph(graph, query);

    return NextResponse.json({
      data: { query, nodeCount: nodes.length, edgeCount: edges.length, nodes, edges },
    });
  } catch (error) {
    console.error("[GET /api/knowledge-graph/search] Error:", error);
    return NextResponse.json({ error: "Failed to search knowledge graph" }, { status: 500 });
  }
}
