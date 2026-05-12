// ============================================================
// Cognitive Operating System — Workflow Continuation
// ============================================================
// Detects workflow interruptions, captures context snapshots,
// and generates AI-powered resumption plans.
// ============================================================

import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

// --------------- Type Definitions ---------------

export interface WorkflowSnapshot {
  sessionId: string;
  type: string; // coding_session, research, debugging, etc.
  title: string;
  tabs: Array<{ url: string; title: string; domain: string; activeTime: number }>;
  memories: Array<Record<string, unknown>>;
  graphNodes: Array<Record<string, unknown>>;
  timestamp: Date;
}

export interface ContinuationResult {
  originalWork: WorkflowSnapshot;
  timeElapsed: string;
  completenessScore: number; // 0-100
  suggestedNextSteps: string[];
  relatedRecentWork: Array<Record<string, unknown>>;
  contextCapsule: string;
}

interface SessionActivity {
  sessionId: string;
  lastActivityAt: Date;
  isActive: boolean;
  eventCount: number;
  memoryCount: number;
}

// --------------- Constants ---------------

const INTERRUPTION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// --------------- In-Memory Snapshot Store ---------------

const snapshotStore = new Map<string, WorkflowSnapshot>();

// --------------- Helper: Format Time Elapsed ---------------

function formatTimeElapsed(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// --------------- Detect Workflow Interruption ---------------

/**
 * Detect if any active workflow has been interrupted
 * (no activity for 30+ minutes, browser closed, etc.)
 */
export async function detectInterruption(userId?: string, sessionId?: string): Promise<SessionActivity[]> {
  const now = new Date();
  const interruptedSessions: SessionActivity[] = [];

  const whereClause: Record<string, unknown> = sessionId
    ? { id: sessionId, isActive: true }
    : { isActive: true };

  if (userId) whereClause.userId = userId;

  const activeSessions = await db.session.findMany({
    where: whereClause,
    include: {
      memories: { select: { id: true }, take: 1 },
      timeline: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true },
      },
    },
  });

  for (const session of activeSessions) {
    const lastEvent = session.timeline[0];
    const lastActivityAt = lastEvent?.createdAt
      ? new Date(lastEvent.createdAt)
      : session.startedAt;

    const timeSinceLastActivity = now.getTime() - lastActivityAt.getTime();

    if (timeSinceLastActivity > INTERRUPTION_THRESHOLD_MS) {
      interruptedSessions.push({
        sessionId: session.id,
        lastActivityAt,
        isActive: false, // Marked as interrupted
        eventCount: session.timeline.length,
        memoryCount: session.memories.length,
      });
    }
  }

  return interruptedSessions;
}

// --------------- Create Workflow Snapshot ---------------

/**
 * Capture a full context snapshot at the point of interruption.
 */
export async function createWorkflowSnapshot(sessionId: string): Promise<WorkflowSnapshot | null> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      memories: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      timeline: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!session) return null;

  // Extract unique tabs from timeline events
  const tabMap = new Map<string, { url: string; title: string; domain: string; activeTime: number }>();
  for (const event of session.timeline) {
    const url = event.url || "";
    const domain = event.domain || "";
    const key = url || domain || event.title;

    if (tabMap.has(key)) {
      const existing = tabMap.get(key)!;
      existing.activeTime += 1; // Approximate: each event = ~1 min
    } else {
      tabMap.set(key, {
        url,
        title: event.title,
        domain,
        activeTime: 1,
      });
    }
  }

  const tabs = Array.from(tabMap.values())
    .sort((a, b) => b.activeTime - a.activeTime)
    .slice(0, 20);

  // Get knowledge graph nodes related to this session
  const relatedNodes: Array<Record<string, unknown>> = [];
  for (const memory of session.memories.slice(0, 10)) {
    relatedNodes.push({
      id: memory.id,
      type: memory.type,
      label: memory.title || memory.content.substring(0, 50),
      metadata: memory.tags ? JSON.parse(memory.tags) : {},
    });
  }

  const snapshot: WorkflowSnapshot = {
    sessionId: session.id,
    type: inferWorkflowType(session, session.timeline),
    title: session.title,
    tabs,
    memories: session.memories.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      summary: m.summary,
      tags: m.tags,
      url: m.url,
      domain: m.domain,
      createdAt: m.createdAt,
    })),
    graphNodes: relatedNodes,
    timestamp: new Date(),
  };

  // Store in memory
  snapshotStore.set(sessionId, snapshot);

  return snapshot;
}

/**
 * Infer the workflow type from session data.
 */
function inferWorkflowType(
  session: { task?: string | null; project?: string | null },
  timeline: Array<{ type: string }>
): string {
  const task = (session.task || "").toLowerCase();
  const project = (session.project || "").toLowerCase();

  if (task.includes("debug") || task.includes("fix") || task.includes("error")) return "debugging";
  if (task.includes("research") || task.includes("investigate") || task.includes("explore")) return "research";
  if (task.includes("implement") || task.includes("build") || task.includes("create")) return "coding_session";
  if (task.includes("review") || task.includes("refactor")) return "review";

  const typeCounts = new Map<string, number>();
  for (const event of timeline) {
    typeCounts.set(event.type, (typeCounts.get(event.type) || 0) + 1);
  }

  if ((typeCounts.get("coding") || 0) > 5) return "coding_session";
  if ((typeCounts.get("search") || 0) > 5) return "research";
  if ((typeCounts.get("navigation") || 0) > 5) return "browsing";

  return "general";
}

// --------------- Generate Continuation Plan ---------------

/**
 * Use AI to analyze a workflow snapshot and generate a resumption plan.
 */
export async function generateContinuationPlan(
  snapshot: WorkflowSnapshot,
  recentActivity?: Array<Record<string, unknown>>
): Promise<ContinuationResult> {
  const timeSinceInterruption = Date.now() - snapshot.timestamp.getTime();
  const timeElapsed = formatTimeElapsed(timeSinceInterruption);

  // Calculate completeness score based on available context
  const completenessScore = calculateCompletenessScore(snapshot);

  // Find related recent work
  const relatedRecentWork = await findRelatedRecentWork(snapshot);

  // Build the prompt for AI continuation analysis
  const snapshotSummary = `
Workflow Type: ${snapshot.type}
Title: ${snapshot.title}
Tabs Open: ${snapshot.tabs.length}
Memories Captured: ${snapshot.memories.length}
Knowledge Nodes: ${snapshot.graphNodes.length}

Active Tabs:
${snapshot.tabs.slice(0, 5).map((t) => `  - ${t.title || t.url} (${t.domain}) — ${t.activeTime}min`).join("\n")}

Recent Memories:
${snapshot.memories.slice(0, 8).map((m) => `  [${m.type}] ${(m.summary || String(m.content)).substring(0, 150)}`).join("\n")}
`.trim();

  const systemPrompt = `You are a Workflow Continuation AI within a Cognitive Operating System. Analyze the interrupted workflow snapshot and generate a plan to help the user resume their work efficiently.

Provide your analysis in this JSON format:
\`\`\`json
{
  "summary": "Brief description of what was being worked on",
  "progressAssessment": "How far along the work was (just started, in progress, nearly done)",
  "suggestedNextSteps": ["Step 1", "Step 2", "Step 3"],
  "keyContextToRestore": ["Context item 1", "Context item 2"],
  "recommendedTabs": ["Tab to reopen 1", "Tab to reopen 2"],
  "priorityLevel": "high|medium|low"
}
\`\`\`

Be specific and actionable. Consider what would be most helpful for the user to quickly regain context.`;

  let suggestedNextSteps: string[] = [];
  let contextCapsule = "";

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: `Analyze this interrupted workflow and suggest how to resume:\n\n${snapshotSummary}` },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const aiContent = completion.choices?.[0]?.message?.content || "";

    try {
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
      const parsed = JSON.parse(jsonStr.trim());
      suggestedNextSteps = parsed.suggestedNextSteps || [];
      contextCapsule = parsed.summary || aiContent;
    } catch {
      contextCapsule = aiContent;
      suggestedNextSteps = [
        "Review the last session's memories and timeline",
        "Reopen the most active tabs",
        "Continue with the pending task",
      ];
    }
  } catch {
    contextCapsule = `Workflow "${snapshot.title}" was interrupted. ${snapshot.memories.length} memories and ${snapshot.tabs.length} tabs were captured.`;
    suggestedNextSteps = [
      "Review the last session's memories and timeline",
      "Reopen the most active tabs",
      "Continue with the pending task",
    ];
  }

  return {
    originalWork: snapshot,
    timeElapsed,
    completenessScore,
    suggestedNextSteps,
    relatedRecentWork,
    contextCapsule,
  };
}

// --------------- Calculate Completeness Score ---------------

function calculateCompletenessScore(snapshot: WorkflowSnapshot): number {
  let score = 50; // Base score

  // More memories = more complete picture (+20)
  score += Math.min(20, snapshot.memories.length);

  // More tabs captured = better context (+15)
  score += Math.min(15, snapshot.tabs.length);

  // Knowledge graph nodes add structure (+10)
  score += Math.min(10, snapshot.graphNodes.length);

  // Workflow type bonus
  const typeBonuses: Record<string, number> = {
    coding_session: 5,
    debugging: 5,
    research: 3,
    review: 5,
    general: 0,
  };
  score += typeBonuses[snapshot.type] || 0;

  return Math.min(100, Math.max(0, score));
}

// --------------- Find Related Recent Work ---------------

async function findRelatedRecentWork(
  snapshot: WorkflowSnapshot
): Promise<Array<Record<string, unknown>>> {
  const recentSessions = await db.session.findMany({
    where: {
      isActive: false,
      project: snapshot.title
        ? { contains: snapshot.title.split(" ")[0] }
        : undefined,
    },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      project: true,
      task: true,
      startedAt: true,
      endedAt: true,
    },
  });

  return recentSessions.filter((s) => s.id !== snapshot.sessionId);
}

// --------------- Resume Workflow ---------------

/**
 * Restore workflow context from a snapshot.
 */
export async function resumeWorkflow(
  snapshotId: string
): Promise<ContinuationResult | null> {
  const snapshot = snapshotStore.get(snapshotId);
  if (!snapshot) {
    // Try to create a new snapshot if we have a session ID
    const created = await createWorkflowSnapshot(snapshotId);
    if (!created) return null;
    return generateContinuationPlan(created);
  }

  return generateContinuationPlan(snapshot);
}

// --------------- Get All Snapshots ---------------

export function getAllSnapshots(): WorkflowSnapshot[] {
  return Array.from(snapshotStore.values());
}

// --------------- Get Snapshot by Session ID ---------------

export function getSnapshot(sessionId: string): WorkflowSnapshot | undefined {
  return snapshotStore.get(sessionId);
}

// --------------- Auto-Detect and Generate Continuations ---------------

/**
 * Scan for interrupted workflows and generate continuation suggestions.
 */
export async function scanAndSuggest(userId?: string): Promise<ContinuationResult[]> {
  const interrupted = await detectInterruption(userId);
  const results: ContinuationResult[] = [];

  for (const session of interrupted) {
    const snapshot = await createWorkflowSnapshot(session.sessionId);
    if (snapshot) {
      const continuation = await generateContinuationPlan(snapshot);
      results.push(continuation);
    }
  }

  return results;
}
