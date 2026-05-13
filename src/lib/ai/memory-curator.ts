// ============================================================
// Cognitive Operating System — Memory Curator
// ============================================================
// AI-powered memory curation: deduplication, compression,
// importance scoring, archival, hierarchical organization,
// and merge handling for imported memories.
// ============================================================

import { adminDb } from '@/lib/firebase'
import { generateId, serverTimestamp } from '@/lib/db'

// --------------- Type Definitions ---------------

export interface MemoryItem {
  id: string;
  type: string;
  content: string;
  summary?: string | null;
  tags?: string | null;
  domain?: string | null;
  url?: string | null;
  projectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  accessCount?: number;
  connectionCount?: number;
}

export interface DuplicateGroup {
  memories: MemoryItem[];
  similarity: number;
  suggestedMaster: string; // ID of the memory to keep
  reason: string;
}

export interface CompressedMemory {
  originalIds: string[];
  compressedContent: string;
  compressedSummary: string;
  type: string;
  memoryCount: number;
  timeRange: { start: Date; end: Date };
}

export interface ImportanceScore {
  memoryId: string;
  score: number; // 0-10
  breakdown: {
    recency: number;
    accessCount: number;
    connections: number;
    type: number;
    projectRelevance: number;
  };
}

export interface MemoryHierarchy {
  roots: HierarchyNode[];
}

export interface HierarchyNode {
  id: string;
  label: string;
  type: string;
  children: HierarchyNode[];
  memoryCount: number;
  level: number;
}

// --------------- Duplicate Detection ---------------

/**
 * Detect similar/duplicate memories using text comparison.
 * Uses a simple TF-IDF-like approach with n-gram overlap.
 */
export async function detectDuplicates(
  memories: MemoryItem[]
): Promise<DuplicateGroup[]> {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < memories.length; i++) {
    if (processed.has(memories[i].id)) continue;

    const duplicates: MemoryItem[] = [memories[i]];

    for (let j = i + 1; j < memories.length; j++) {
      if (processed.has(memories[j].id)) continue;

      const similarity = calculateTextSimilarity(
        memories[i].content,
        memories[j].content
      );

      if (similarity > 0.7) {
        duplicates.push(memories[j]);
      }
    }

    if (duplicates.length > 1) {
      // Determine master: prefer the one with more detail, recency, and connections
      const master = duplicates.sort((a, b) => {
        // Prefer memories with summaries
        if (a.summary && !b.summary) return -1;
        if (!a.summary && b.summary) return 1;
        // Prefer more recent
        return b.createdAt.getTime() - a.createdAt.getTime();
      })[0];

      const avgSimilarity =
        duplicates.slice(1).reduce((sum, d) => {
          return sum + calculateTextSimilarity(memories[i].content, d.content);
        }, 0) / (duplicates.length - 1);

      groups.push({
        memories: duplicates,
        similarity: Math.round(avgSimilarity * 100) / 100,
        suggestedMaster: master.id,
        reason:
          duplicates.length === 2
            ? "Two memories contain nearly identical content"
            : `Group of ${duplicates.length} memories with highly similar content`,
      });

      for (const d of duplicates) {
        processed.add(d.id);
      }
    }
  }

  return groups;
}

/**
 * Calculate text similarity using Jaccard similarity on word n-grams.
 */
function calculateTextSimilarity(textA: string, textB: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);

  const wordsA = normalize(textA);
  const wordsB = normalize(textB);

  if (wordsA.length === 0 && wordsB.length === 0) return 1;
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  // Generate bigrams
  const bigramsA = new Set<string>();
  for (let i = 0; i < wordsA.length - 1; i++) {
    bigramsA.add(`${wordsA[i]} ${wordsA[i + 1]}`);
  }

  const bigramsB = new Set<string>();
  for (let i = 0; i < wordsB.length - 1; i++) {
    bigramsB.add(`${wordsB[i]} ${wordsB[i + 1]}`);
  }

  // Also use unigrams
  const unigramsA = new Set(wordsA);
  const unigramsB = new Set(wordsB);

  // Combined Jaccard similarity
  const bigramSimilarity = jaccardSimilarity(bigramsA, bigramsB);
  const unigramSimilarity = jaccardSimilarity(unigramsA, unigramsB);

  // Weighted combination
  return bigramSimilarity * 0.6 + unigramSimilarity * 0.4;
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// --------------- Memory Compression ---------------

/**
 * Compress repetitive memories into summaries.
 * Groups memories by type and time range, then creates consolidated summaries.
 */
export async function compressMemories(
  memories: MemoryItem[],
  timeRange?: { start: Date; end: Date }
): Promise<CompressedMemory[]> {
  // Filter by time range if provided
  const filtered = timeRange
    ? memories.filter(
        (m) =>
          m.createdAt >= timeRange.start && m.createdAt <= timeRange.end
      )
    : memories;

  // Group by type
  const typeGroups = new Map<string, MemoryItem[]>();
  for (const memory of filtered) {
    const group = typeGroups.get(memory.type) || [];
    group.push(memory);
    typeGroups.set(memory.type, group);
  }

  const compressed: CompressedMemory[] = [];

  for (const [type, group] of typeGroups) {
    // Further group by topic similarity within each type
    const topicClusters = clusterByTopic(group);

    for (const cluster of topicClusters) {
      if (cluster.length < 2) continue; // Only compress groups of 2+

      const sorted = cluster.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      const compressedContent = `Compressed from ${cluster.length} ${type} memories:\n${sorted
        .map((m, i) => `${i + 1}. ${(m.summary || m.content).substring(0, 100)}`)
        .join("\n")}`;

      const compressedSummary = generateCompressionSummary(sorted, type);

      compressed.push({
        originalIds: sorted.map((m) => m.id),
        compressedContent,
        compressedSummary,
        type,
        memoryCount: cluster.length,
        timeRange: {
          start: sorted[0].createdAt,
          end: sorted[sorted.length - 1].createdAt,
        },
      });
    }
  }

  return compressed;
}

/**
 * Cluster memories by topic similarity within a type group.
 */
function clusterByTopic(memories: MemoryItem[]): MemoryItem[][] {
  if (memories.length <= 1) return [memories];

  const clusters: MemoryItem[][] = [];
  const assigned = new Set<string>();

  for (const memory of memories) {
    if (assigned.has(memory.id)) continue;

    const cluster: MemoryItem[] = [memory];
    assigned.add(memory.id);

    for (const other of memories) {
      if (assigned.has(other.id)) continue;

      const similarity = calculateTextSimilarity(memory.content, other.content);
      if (similarity > 0.4) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Generate a summary for a compressed group of memories.
 */
function generateCompressionSummary(memories: MemoryItem[], type: string): string {
  const contents = memories.map(
    (m) => m.summary || m.content.substring(0, 200)
  );

  // Extract common keywords
  const keywordFreq = new Map<string, number>();
  for (const content of contents) {
    const words = content.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    for (const word of words) {
      keywordFreq.set(word, (keywordFreq.get(word) || 0) + 1);
    }
  }

  const topKeywords = Array.from(keywordFreq.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  const keywordsStr = topKeywords.length > 0 ? ` [${topKeywords.join(", ")}]` : "";
  const dateRange =
    memories.length > 1
      ? ` (${formatDateShort(memories[0].createdAt)} — ${formatDateShort(memories[memories.length - 1].createdAt)})`
      : "";

  return `Compressed ${memories.length} ${type} memories${keywordsStr}${dateRange}. Covers: ${contents[0].substring(0, 100)}...`;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// --------------- Importance Scoring ---------------

/**
 * Score memory importance (0-10) based on multiple factors.
 */
export function calculateImportance(memory: MemoryItem): ImportanceScore {
  // Recency score (0-3): More recent = higher score
  const ageInDays = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 3 * Math.exp(-ageInDays / 30));

  // Access count score (0-2): More accesses = higher score
  const accessScore = Math.min(2, (memory.accessCount || 0) * 0.5);

  // Connection count score (0-2): More connections = higher score
  const connectionScore = Math.min(2, (memory.connectionCount || 0) * 0.4);

  // Type score (0-2): Some types are inherently more important
  const typeScores: Record<string, number> = {
    decision: 2,
    code: 1.8,
    research: 1.5,
    reference: 1.2,
    snippet: 1,
    general: 0.5,
  };
  const typeScore = typeScores[memory.type] || 0.5;

  // Project relevance score (0-1): Attached to a project = higher score
  const projectScore = memory.projectId ? 1 : 0.3;

  const totalScore =
    recencyScore + accessScore + connectionScore + typeScore + projectScore;

  return {
    memoryId: memory.id,
    score: Math.round(Math.min(10, totalScore) * 10) / 10,
    breakdown: {
      recency: Math.round(recencyScore * 10) / 10,
      accessCount: Math.round(accessScore * 10) / 10,
      connections: Math.round(connectionScore * 10) / 10,
      type: Math.round(typeScore * 10) / 10,
      projectRelevance: Math.round(projectScore * 10) / 10,
    },
  };
}

// --------------- Memory Archival ---------------

/**
 * Archive low-importance memories (mark them in the database).
 * Returns the list of archived memory IDs.
 */
export async function archiveMemories(
  memories: MemoryItem[],
  threshold: number = 3.0
): Promise<string[]> {
  const archivedIds: string[] = [];

  for (const memory of memories) {
    const importance = calculateImportance(memory);
    if (importance.score < threshold) {
      // Update the memory to mark as archived (using tags)
      try {
        const existingTags: string[] = memory.tags
          ? (typeof memory.tags === 'string' ? JSON.parse(memory.tags) : Array.isArray(memory.tags) ? memory.tags : [])
          : [];
        if (!existingTags.includes("archived")) {
          await adminDb.collection('memories').doc(memory.id).update({
            tags: JSON.stringify([...existingTags, "archived"]),
          });
          archivedIds.push(memory.id);
        }
      } catch {
        // Skip if DB update fails
      }
    }
  }

  return archivedIds;
}

// --------------- Memory Hierarchy ---------------

/**
 * Organize memories into hierarchical structures based on
 * type, project, and content similarity.
 */
export function buildMemoryHierarchy(memories: MemoryItem[]): MemoryHierarchy {
  // Level 0: Root groups by type
  const typeGroups = new Map<string, MemoryItem[]>();
  for (const memory of memories) {
    const group = typeGroups.get(memory.type) || [];
    group.push(memory);
    typeGroups.set(memory.type, group);
  }

  const roots: HierarchyNode[] = [];

  for (const [type, groupMemories] of typeGroups) {
    // Level 1: Sub-groups by project
    const projectGroups = new Map<string, MemoryItem[]>();
    for (const m of groupMemories) {
      const key = m.projectId || "__unassigned__";
      const pg = projectGroups.get(key) || [];
      pg.push(m);
      projectGroups.set(key, pg);
    }

    const children: HierarchyNode[] = [];

    for (const [projectId, projectMemories] of projectGroups) {
      // Level 2: Sub-groups by topic similarity
      const topicClusters = clusterByTopic(projectMemories);

      const topicChildren: HierarchyNode[] = topicClusters.map((cluster, idx) => {
        const representative = cluster.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0];
        const label =
          cluster.length > 1
            ? `${representative.content.substring(0, 40)}... (+${cluster.length - 1})`
            : representative.content.substring(0, 60);

        return {
          id: `topic-${projectId}-${idx}`,
          label,
          type: "topic",
          children: [],
          memoryCount: cluster.length,
          level: 2,
        };
      });

      children.push({
        id: `project-${projectId}`,
        label: projectId === "__unassigned__" ? "Unassigned" : `Project: ${projectId}`,
        type: "project",
        children: topicChildren,
        memoryCount: projectMemories.length,
        level: 1,
      });
    }

    roots.push({
      id: `type-${type}`,
      label: capitalize(type),
      type: "memory_type",
      children,
      memoryCount: groupMemories.length,
      level: 0,
    });
  }

  // Sort roots by memory count (most populated first)
  roots.sort((a, b) => b.memoryCount - a.memoryCount);

  return { roots };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// --------------- Memory Merge ---------------

/**
 * Merge an imported memory with existing memories.
 * Detects duplicates and merges content appropriately.
 */
export async function mergeImportedMemory(
  imported: Omit<MemoryItem, "id">,
  existingMemories: MemoryItem[]
): Promise<{ action: "created" | "merged" | "skipped"; memoryId?: string; mergedWith?: string }> {
  // Check for duplicates
  for (const existing of existingMemories) {
    const similarity = calculateTextSimilarity(
      imported.content,
      existing.content
    );

    if (similarity > 0.8) {
      // Very similar — merge into existing
      const mergedContent = mergeContent(existing.content, imported.content);
      const existingTags: string[] = existing.tags
        ? JSON.parse(existing.tags)
        : [];
      const importedTags: string[] = imported.tags
        ? JSON.parse(imported.tags)
        : [];
      const mergedTags = [...new Set([...existingTags, ...importedTags, "merged"])];

      await adminDb.collection('memories').doc(existing.id).update({
        content: mergedContent,
        tags: JSON.stringify(mergedTags),
        updatedAt: new Date(),
      });

      return { action: "merged", memoryId: existing.id, mergedWith: existing.id };
    }

    if (similarity > 0.6) {
      // Somewhat similar — add as related
      try {
        await adminDb.collection('memoryRelations').add({
          fromId: existing.id,
          toId: imported.id || "",
          type: "related",
          strength: similarity,
          createdAt: serverTimestamp,
        });
      } catch {
        // Relation may already exist
      }
    }
  }

  // No duplicate found — create new memory
  const newId = generateId();
  await adminDb.collection('memories').doc(newId).set({
    type: imported.type,
    content: imported.content,
    summary: imported.summary || null,
    tags: imported.tags || null,
    domain: imported.domain || null,
    url: imported.url || null,
    projectId: imported.projectId || null,
    isSensitive: false,
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
  });

  return { action: "created", memoryId: newId };
}

/**
 * Merge two content strings, preserving unique information from both.
 */
function mergeContent(contentA: string, contentB: string): string {
  // If contents are very similar, just use the longer one
  if (
    Math.abs(contentA.length - contentB.length) < contentA.length * 0.2
  ) {
    return contentA.length >= contentB.length ? contentA : contentB;
  }

  // Use the longer content as base and append unique parts
  const base = contentA.length >= contentB.length ? contentA : contentB;
  const supplement = contentA.length >= contentB.length ? contentB : contentA;

  // Simple merge: use base and add sentences from supplement not in base
  const baseSentences = new Set(base.split(/[.!?]+/).map((s) => s.trim().toLowerCase()));
  const uniqueSentences = supplement
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && !baseSentences.has(s.toLowerCase()));

  if (uniqueSentences.length === 0) return base;

  return `${base}\n\nAdditionally: ${uniqueSentences.slice(0, 3).join(". ")}.`;
}
