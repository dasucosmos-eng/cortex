// ============================================================
// Cognitive Operating System — Knowledge Engine
// ============================================================
// Knowledge graph engine: entity extraction, graph construction,
// path finding, cluster detection, connection suggestions,
// and node ranking.
// ============================================================

import { db } from "@/lib/db";

// --------------- Type Definitions ---------------

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  metadata?: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  type: string;
  strength: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphUpdate {
  nodes: Array<{ id: string; type: string; label: string; metadata?: Record<string, unknown> }>;
  edges: Array<{ fromId: string; toId: string; type: string; strength: number }>;
}

export interface GraphCluster {
  id: string;
  label: string;
  nodeIds: string[];
  centralNode: string;
  cohesion: number; // 0-1
}

export interface GraphPath {
  nodes: string[];
  edges: Array<{ from: string; to: string; type: string }>;
  totalStrength: number;
}

export interface RankedNode {
  id: string;
  label: string;
  type: string;
  score: number;
  inDegree: number;
  outDegree: number;
  clusteringCoefficient: number;
}

// --------------- In-Memory Graph Cache ---------------

let graphCache: KnowledgeGraph | null = null;

// --------------- Entity Extraction ---------------

/**
 * Extract concepts, technologies, people, projects from text.
 * Uses pattern matching and keyword dictionaries.
 */
export function extractEntities(text: string): Array<{ id: string; type: string; label: string }> {
  const entities: Array<{ id: string; type: string; label: string }> = [];
  const seen = new Set<string>();

  const addEntity = (label: string, type: string) => {
    const normalized = label.toLowerCase().trim();
    if (normalized.length < 2 || seen.has(normalized)) return;
    seen.add(normalized);
    entities.push({
      id: `entity-${type}-${Buffer.from(normalized).toString("base64url").substring(0, 16)}`,
      type,
      label,
    });
  };

  // Technology/Framework patterns
  const techPatterns = /\b(React|Vue|Angular|Next\.?js|Nuxt|Svelte|Express|NestJS|Fastify|Django|Flask|Rails|Spring|Laravel|Node\.?js|TypeScript|JavaScript|Python|Rust|Go|Java|C\+\+|Ruby|Swift|Kotlin|PHP|Elixir|Scala|Haskell|GraphQL|REST|gRPC|WebSocket|Prisma|Sequelize|TypeORM|Mongoose|PostgreSQL|MySQL|MongoDB|Redis|SQLite|Elasticsearch|Docker|Kubernetes|AWS|GCP|Azure|Terraform|Vercel|Netlify|GitHub|GitLab|Webpack|Vite|esbuild|Tailwind|Bootstrap|Sass|CSS|HTML|WebAssembly)\b/gi;
  const techMatches = text.match(techPatterns);
  if (techMatches) {
    for (const match of techMatches) {
      addEntity(match, "technology");
    }
  }

  // Programming concepts
  const conceptPatterns = /\b(async|await|Promise|callback|closure|memoization|virtualization|containerization|microservice|monolith|serverless|edge.?computing|CI\/CD|TDD|BDD|agile|scrum|kanban|RESTful|OAuth|JWT|RBAC|SSO|encryption|hashing|caching|load.?balancing|sharding|replication|indexing|optimization|refactoring|design.?pattern|singleton|factory|observer|middleware|hook|store|reducer|state.?management|component|composition|inheritance|polymorphism|abstraction|encapsulation)\b/gi;
  const conceptMatches = text.match(conceptPatterns);
  if (conceptMatches) {
    for (const match of conceptMatches) {
      addEntity(match, "concept");
    }
  }

  // URL patterns (domains as entities)
  const urlPatterns = /https?:\/\/(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/g;
  const urlMatches = text.match(urlPatterns);
  if (urlMatches) {
    for (const match of urlMatches) {
      try {
        const domain = new URL(match).hostname;
        addEntity(domain, "domain");
      } catch {
        // Invalid URL, skip
      }
    }
  }

  // File path patterns
  const filePathPatterns = /\b([a-zA-Z0-9_\-./]+\.(ts|tsx|js|jsx|py|rs|go|java|rb|swift|kt|php|css|scss|html|json|yaml|yml|toml|md|sql|sh|bash|zsh))\b/g;
  const filePathMatches = text.match(filePathPatterns);
  if (filePathMatches) {
    for (const match of filePathMatches) {
      const fileName = match.split("/").pop() || match;
      addEntity(fileName, "file");
    }
  }

  // Named entities (capitalized multi-word phrases, 2-4 words)
  const namedPatterns = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
  const namedMatches = text.match(namedPatterns);
  if (namedMatches) {
    for (const match of namedMatches) {
      if (!seen.has(match.toLowerCase())) {
        addEntity(match, "named_entity");
      }
    }
  }

  // Project-like patterns
  const projectPatterns = /(?:project|app|service|lib|module|package)\s+(?:called|named|titled)\s+["']?([A-Za-z0-9\s_-]+?)["']?\b/gi;
  const projectMatches = text.match(projectPatterns);
  if (projectMatches) {
    for (const match of projectMatches) {
      const projectName = match.replace(/^(?:project|app|service|lib|module|package)\s+(?:called|named|titled)\s+["']?/i, "").replace(/["']$/, "");
      addEntity(projectName, "project");
    }
  }

  return entities;
}

// --------------- Build Graph from Memories ---------------

/**
 * Convert memories into a knowledge graph structure.
 */
export async function buildGraphFromMemories(): Promise<KnowledgeGraph> {
  const memories = await db.memory.findMany({
    where: { isSensitive: false },
    include: {
      relatedFrom: true,
      relatedTo: true,
    },
    take: 200,
    orderBy: { createdAt: "desc" },
  });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  // Add memories as nodes
  for (const memory of memories) {
    if (!nodeIds.has(memory.id)) {
      nodes.push({
        id: memory.id,
        type: memory.type,
        label: (memory.title || memory.summary || memory.content).substring(0, 60),
        metadata: {
          tags: memory.tags ? JSON.parse(memory.tags) : [],
          domain: memory.domain,
          projectId: memory.projectId,
          createdAt: memory.createdAt,
        },
      });
      nodeIds.add(memory.id);
    }

    // Add memory relations as edges
    for (const rel of memory.relatedFrom) {
      if (!nodeIds.has(rel.toId)) {
        nodeIds.add(rel.toId);
        nodes.push({
          id: rel.toId,
          type: "memory",
          label: `Memory: ${rel.toId.substring(0, 8)}`,
        });
      }
      edges.push({
        fromId: memory.id,
        toId: rel.toId,
        type: rel.type,
        strength: rel.strength,
      });
    }

    for (const rel of memory.relatedTo) {
      if (!nodeIds.has(rel.fromId)) {
        nodeIds.add(rel.fromId);
        nodes.push({
          id: rel.fromId,
          type: "memory",
          label: `Memory: ${rel.fromId.substring(0, 8)}`,
        });
      }
      edges.push({
        fromId: rel.fromId,
        toId: memory.id,
        type: rel.type,
        strength: rel.strength,
      });
    }

    // Extract and add entities as nodes
    const entities = extractEntities(memory.content + " " + (memory.summary || ""));
    for (const entity of entities) {
      if (!nodeIds.has(entity.id)) {
        nodes.push({
          id: entity.id,
          type: entity.type,
          label: entity.label,
        });
        nodeIds.add(entity.id);

        // Connect entity to memory
        edges.push({
          fromId: memory.id,
          toId: entity.id,
          type: "mentions",
          strength: 0.8,
        });
      } else {
        // Reinforce existing connection
        const existingEdge = edges.find(
          (e) =>
            (e.fromId === memory.id && e.toId === entity.id) ||
            (e.fromId === entity.id && e.toId === memory.id)
        );
        if (existingEdge) {
          existingEdge.strength = Math.min(1.0, existingEdge.strength + 0.1);
        }
      }
    }
  }

  const graph: KnowledgeGraph = { nodes, edges };
  graphCache = graph;
  return graph;
}

// --------------- Shortest Path ---------------

/**
 * Find the shortest path between two nodes in the graph.
 * Uses Dijkstra's algorithm with edge strength as weights.
 */
export function findShortestPath(
  graph: KnowledgeGraph,
  fromId: string,
  toId: string
): GraphPath | null {
  if (!graphCache) graphCache = graph;

  // Build adjacency list
  const adjacency = new Map<string, Array<{ nodeId: string; weight: number; type: string }>>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const weight = 1 - edge.strength; // Invert strength (higher strength = shorter distance)
    adjacency.get(edge.fromId)?.push({ nodeId: edge.toId, weight, type: edge.type });
    adjacency.get(edge.toId)?.push({ nodeId: edge.fromId, weight, type: edge.type });
  }

  // Dijkstra's algorithm
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const edgeTypes = new Map<string, string>();
  const visited = new Set<string>();

  for (const node of graph.nodes) {
    distances.set(node.id, Infinity);
  }
  distances.set(fromId, 0);

  while (true) {
    // Find unvisited node with smallest distance
    let current: string | null = null;
    let minDist = Infinity;
    for (const [nodeId, dist] of distances) {
      if (!visited.has(nodeId) && dist < minDist) {
        minDist = dist;
        current = nodeId;
      }
    }

    if (current === null || current === toId) break;

    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) continue;
      const newDist = distances.get(current)! + neighbor.weight;
      if (newDist < distances.get(neighbor.nodeId)!) {
        distances.set(neighbor.nodeId, newDist);
        previous.set(neighbor.nodeId, current);
        edgeTypes.set(neighbor.nodeId, neighbor.type);
      }
    }
  }

  if (distances.get(toId) === Infinity) return null;

  // Reconstruct path
  const pathNodes: string[] = [];
  const pathEdges: Array<{ from: string; to: string; type: string }> = [];
  let current: string | undefined = toId;

  while (current && current !== fromId) {
    pathNodes.unshift(current);
    const prev = previous.get(current);
    if (prev) {
      pathEdges.unshift({
        from: prev,
        to: current,
        type: edgeTypes.get(current) || "unknown",
      });
    }
    current = prev;
  }
  pathNodes.unshift(fromId);

  return {
    nodes: pathNodes,
    edges: pathEdges,
    totalStrength: 1 - distances.get(toId)!,
  };
}

// --------------- Cluster Detection ---------------

/**
 * Find topic clusters in the graph using connected components
 * with a minimum edge strength threshold.
 */
export function detectClusters(graph: KnowledgeGraph, minStrength: number = 0.5): GraphCluster[] {
  // Build adjacency with strength filter
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    if (edge.strength >= minStrength) {
      adjacency.get(edge.fromId)?.add(edge.toId);
      adjacency.get(edge.toId)?.add(edge.fromId);
    }
  }

  // Find connected components
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;

    const component: string[] = [];
    const queue = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      for (const neighbor of adjacency.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (component.length >= 2) {
      components.push(component);
    }
  }

  // Build cluster objects
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  return components.map((component, idx) => {
    // Find central node (highest degree within cluster)
    const degreeMap = new Map<string, number>();
    for (const nodeId of component) {
      degreeMap.set(nodeId, 0);
    }
    for (const edge of graph.edges) {
      if (
        component.includes(edge.fromId) &&
        component.includes(edge.toId)
      ) {
        degreeMap.set(edge.fromId, (degreeMap.get(edge.fromId) || 0) + 1);
        degreeMap.set(edge.toId, (degreeMap.get(edge.toId) || 0) + 1);
      }
    }

    let centralNode = component[0];
    let maxDegree = 0;
    for (const [nodeId, degree] of degreeMap) {
      if (degree > maxDegree) {
        maxDegree = degree;
        centralNode = nodeId;
      }
    }

    // Calculate cohesion (ratio of actual edges to possible edges)
    const internalEdges = graph.edges.filter(
      (e) => component.includes(e.fromId) && component.includes(e.toId)
    ).length;
    const maxEdges = (component.length * (component.length - 1)) / 2;
    const cohesion = maxEdges > 0 ? internalEdges / maxEdges : 0;

    const centralNodeObj = nodeMap.get(centralNode);
    const label = centralNodeObj?.label || `Cluster ${idx + 1}`;

    return {
      id: `cluster-${idx}`,
      label,
      nodeIds: component,
      centralNode,
      cohesion: Math.round(cohesion * 100) / 100,
    };
  }).sort((a, b) => b.nodeIds.length - a.nodeIds.length);
}

// --------------- Connection Suggestions ---------------

/**
 * Suggest potential connections for a node based on
 * shared neighbors and type compatibility.
 */
export function suggestConnections(
  graph: KnowledgeGraph,
  nodeId: string,
  maxSuggestions: number = 5
): Array<{ targetId: string; targetLabel: string; reason: string; score: number }> {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  // Get current neighbors
  const neighbors = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.fromId === nodeId) neighbors.add(edge.toId);
    if (edge.toId === nodeId) neighbors.add(edge.fromId);
  }

  // Get neighbors' neighbors (2-hop network)
  const twoHop = new Map<string, number>();
  for (const neighborId of neighbors) {
    for (const edge of graph.edges) {
      if (edge.fromId === neighborId && !neighbors.has(edge.toId) && edge.toId !== nodeId) {
        twoHop.set(edge.toId, (twoHop.get(edge.toId) || 0) + 1);
      }
      if (edge.toId === neighborId && !neighbors.has(edge.fromId) && edge.fromId !== nodeId) {
        twoHop.set(edge.fromId, (twoHop.get(edge.fromId) || 0) + 1);
      }
    }
  }

  const suggestions: Array<{ targetId: string; targetLabel: string; reason: string; score: number }> = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const [targetId, sharedNeighborCount] of twoHop) {
    const target = nodeMap.get(targetId);
    if (!target) continue;

    // Check if already connected
    const alreadyConnected = graph.edges.some(
      (e) =>
        (e.fromId === nodeId && e.toId === targetId) ||
        (e.fromId === targetId && e.toId === nodeId)
    );
    if (alreadyConnected) continue;

    // Calculate score based on shared neighbors and type compatibility
    const sharedScore = Math.min(1, sharedNeighborCount / 3);
    const typeMatch = node.type === target.type ? 0.3 : 0;
    const score = sharedScore + typeMatch;

    // Determine reason
    let reason = `Shares ${sharedNeighborCount} common neighbor${sharedNeighborCount > 1 ? "s" : ""}`;
    if (node.type === target.type) {
      reason += `; same type (${node.type})`;
    }

    suggestions.push({
      targetId,
      targetLabel: target.label,
      reason,
      score: Math.round(score * 100) / 100,
    });
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
}

// --------------- Node Ranking ---------------

/**
 * Rank nodes by importance/activity using a simplified PageRank-like algorithm.
 */
export function rankNodes(
  graph: KnowledgeGraph,
  iterations: number = 20,
  dampingFactor: number = 0.85
): RankedNode[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const scores = new Map<string, number>();

  // Initialize with equal scores
  const initialScore = 1 / graph.nodes.length;
  for (const node of graph.nodes) {
    scores.set(node.id, initialScore);
  }

  // Build adjacency for out-degree calculation
  const outDegrees = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of graph.nodes) {
    outgoing.set(node.id, []);
    outDegrees.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    outgoing.get(edge.fromId)?.push(edge.toId);
    outDegrees.set(edge.fromId, (outDegrees.get(edge.fromId) || 0) + 1);
  }

  // Iterative PageRank
  for (let i = 0; i < iterations; i++) {
    const newScores = new Map<string, number>();

    for (const node of graph.nodes) {
      let sum = 0;
      // Find all nodes that point to this node
      for (const edge of graph.edges) {
        if (edge.toId === node.id) {
          const outDeg = outDegrees.get(edge.fromId) || 1;
          const senderScore = scores.get(edge.fromId) || 0;
          sum += (senderScore / outDeg) * edge.strength;
        }
      }

      const newScore =
        (1 - dampingFactor) / graph.nodes.length +
        dampingFactor * sum;
      newScores.set(node.id, newScore);
    }

    for (const [id, score] of newScores) {
      scores.set(id, score);
    }
  }

  // Calculate in/out degrees and clustering coefficients
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();

  for (const node of graph.nodes) {
    inDegreeMap.set(node.id, 0);
    outDegreeMap.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    inDegreeMap.set(edge.fromId, (inDegreeMap.get(edge.fromId) || 0) + 1);
    outDegreeMap.set(edge.toId, (outDegreeMap.get(edge.toId) || 0) + 1);
  }

  // Build ranking results
  const ranked: RankedNode[] = graph.nodes.map((node) => {
    const inDeg = inDegreeMap.get(node.id) || 0;
    const outDeg = outDegreeMap.get(node.id) || 0;
    const neighbors = new Set<string>();

    for (const edge of graph.edges) {
      if (edge.fromId === node.id) neighbors.add(edge.toId);
      if (edge.toId === node.id) neighbors.add(edge.fromId);
    }

    // Clustering coefficient
    const neighborList = Array.from(neighbors);
    let triangles = 0;
    const possibleTriangles =
      neighborList.length > 1
        ? (neighborList.length * (neighborList.length - 1)) / 2
        : 0;

    if (possibleTriangles > 0) {
      for (let i = 0; i < neighborList.length; i++) {
        for (let j = i + 1; j < neighborList.length; j++) {
          const connected = graph.edges.some(
            (e) =>
              (e.fromId === neighborList[i] && e.toId === neighborList[j]) ||
              (e.fromId === neighborList[j] && e.toId === neighborList[i])
          );
          if (connected) triangles++;
        }
      }
    }

    const clusteringCoefficient =
      possibleTriangles > 0 ? triangles / possibleTriangles : 0;

    return {
      id: node.id,
      label: node.label,
      type: node.type,
      score: scores.get(node.id) || 0,
      inDegree: inDeg,
      outDegree: outDeg,
      clusteringCoefficient: Math.round(clusteringCoefficient * 100) / 100,
    };
  });

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}

// --------------- Get Cached Graph ---------------

export function getCachedGraph(): KnowledgeGraph | null {
  return graphCache;
}

// --------------- Invalidate Cache ---------------

export function invalidateGraphCache(): void {
  graphCache = null;
}

// --------------- Search Graph ---------------

/**
 * Search the knowledge graph for nodes matching a query.
 */
export function searchGraph(
  graph: KnowledgeGraph,
  query: string
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const lowerQuery = query.toLowerCase();
  const matchingNodes = graph.nodes.filter(
    (n) =>
      n.label.toLowerCase().includes(lowerQuery) ||
      n.type.toLowerCase().includes(lowerQuery)
  );

  const matchingNodeIds = new Set(matchingNodes.map((n) => n.id));

  // Include edges connected to matching nodes
  const matchingEdges = graph.edges.filter(
    (e) => matchingNodeIds.has(e.fromId) || matchingNodeIds.has(e.toId)
  );

  // Also include the connected nodes
  const connectedNodeIds = new Set(matchingNodeIds);
  for (const edge of matchingEdges) {
    connectedNodeIds.add(edge.fromId);
    connectedNodeIds.add(edge.toId);
  }

  const allNodes = graph.nodes.filter((n) => connectedNodeIds.has(n.id));

  return { nodes: allNodes, edges: matchingEdges };
}

// --------------- Apply Graph Update ---------------

export function applyGraphUpdate(graph: KnowledgeGraph, update: GraphUpdate): KnowledgeGraph {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgeSet = new Set(
    graph.edges.map((e) => `${e.fromId}->${e.toId}`)
  );

  // Add or update nodes
  for (const nodeUpdate of update.nodes) {
    if (nodeMap.has(nodeUpdate.id)) {
      const existing = nodeMap.get(nodeUpdate.id)!;
      existing.label = nodeUpdate.label;
      existing.type = nodeUpdate.type;
      if (nodeUpdate.metadata) {
        existing.metadata = { ...existing.metadata, ...nodeUpdate.metadata };
      }
    } else {
      nodeMap.set(nodeUpdate.id, {
        id: nodeUpdate.id,
        type: nodeUpdate.type,
        label: nodeUpdate.label,
        metadata: nodeUpdate.metadata,
      });
    }
  }

  // Add new edges
  for (const edgeUpdate of update.edges) {
    const key = `${edgeUpdate.fromId}->${edgeUpdate.toId}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: [
      ...graph.edges,
      ...update.edges
        .filter((e) => !edgeSet.has(`${e.fromId}->${e.toId}`))
        .map((e) => ({ ...e })),
    ],
  };
}
