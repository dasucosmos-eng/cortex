// ============================================================
// AI Browser Memory Extension — AI Context Builder
// ============================================================
// Builds a sanitised "context capsule" that summarises the
// user's current session, recent memories, and timeline into
// a compact structure safe for sending to AI systems.
//
// Sensitive data is ALWAYS stripped before inclusion.
// ============================================================

import {
  detectSensitiveData,
  sanitizeContent,
  shouldIgnoreUrl,
} from "@/lib/security";

// --------------- Type Definitions ---------------

export interface ContextCapsule {
  /** The name of the project associated with the current session. */
  currentProject: string | null;
  /** The task the user is working on (from active session). */
  currentTask: string | null;
  /** Up to 10 recent memory summaries (sanitised). */
  recentWork: string[];
  /** Up to 5 relevant reference summaries. */
  relevantReferences: string[];
  /** AI-inferred likely next step based on timeline trajectory. */
  likelyNextStep: string;
  /** A concise natural-language summary of the session, if available. */
  sessionSummary: string | null;
  /** ISO-8601 timestamp of when this capsule was generated. */
  timestamp: string;
}

// --------------- Sanitisation Helpers ---------------

/**
 * Run sensitive-data detection on `text` and return a
 * sanitised version.  If the URL associated with the text
 * belongs to an ignored domain (banking, auth, etc.),
 * the original text is returned as-is since the user is
 * intentionally entering credentials there.
 */
function sanitiseWithUrlContext(text: string, url?: string | null): string {
  if (!text || typeof text !== "string") return text;
  if (url && shouldIgnoreUrl(url)) return text;
  return sanitizeContent(text);
}

/**
 * Maximum length for each memory summary entry in the capsule.
 */
const MAX_SUMMARY_LENGTH = 200;

function truncate(str: string, max = MAX_SUMMARY_LENGTH): string {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.substring(0, max).trimEnd() + "…";
}

// --------------- Infer Likely Next Step ---------------

/**
 * Heuristic that inspects recent timeline events to guess what
 * the user might be about to do next.  This is deliberately
 * lightweight — it just looks at the *types* of recent events.
 */
function inferLikelyNextStep(
  timelineEvents: Array<{ type: string; title?: string | null }>
): string {
  if (!timelineEvents || timelineEvents.length === 0) {
    return "No recent activity to infer a next step.";
  }

  // Look at the last 5 events for pattern matching
  const recent = timelineEvents.slice(0, 5);
  const types = recent.map((e) => e.type);

  // Predominantly searching → likely researching more
  if (types.filter((t) => t === "search").length >= 3) {
    return "Likely continuing research — multiple recent searches detected.";
  }

  // Predominantly coding → likely implementing
  if (types.filter((t) => t === "coding").length >= 3) {
    return "Likely continuing implementation — heavy coding activity detected.";
  }

  // Mix of navigation + search → likely exploring
  if (
    types.includes("navigation") &&
    types.includes("search")
  ) {
    return "Likely exploring topics — mix of navigation and search activity.";
  }

  // Last event type as a fallback hint
  const lastType = recent[0]?.type;
  const hints: Record<string, string> = {
    tab_opened: "Likely beginning a new line of inquiry — new tab opened.",
    search: "Likely continuing research — recent search detected.",
    navigation: "Likely browsing documentation or references.",
    coding: "Likely writing or editing code.",
    decision: "Recent decision made — may be ready to implement.",
    note_created: "Recent note taken — may be capturing context before next action.",
  };

  return hints[lastType ?? ""] ?? "Activity detected — context available in recent memories.";
}

// --------------- Build Context Capsule ---------------

/**
 * Construct a sanitised `ContextCapsule` from the given session,
 * memories, and timeline events.
 *
 * **Important**: Sensitive data is ALWAYS stripped from every
 * text field before it is included in the capsule.
 */
export function buildContextCapsule(
  session: {
    project?: string | null;
    task?: string | null;
    summary?: string | null;
    intent?: string | null;
    title?: string | null;
    startedAt?: string | null;
  } | null,
  memories: Array<{
    id?: string;
    type?: string;
    content?: string;
    summary?: string | null;
    url?: string | null;
    domain?: string | null;
    title?: string | null;
    tags?: string | null;
    createdAt?: string | null;
  }>,
  timelineEvents: Array<{
    id?: string;
    type: string;
    title?: string | null;
    url?: string | null;
    domain?: string | null;
    createdAt?: string | null;
  }>
): ContextCapsule {
  // 1. Project & task from session
  const currentProject = session?.project ?? null;
  const currentTask = session?.task ?? null;

  // 2. Sanitised recent work (up to 10 memories)
  const recentWork: string[] = memories
    .slice(0, 10)
    .map((mem) => {
      const raw = mem.summary ?? mem.content ?? mem.title ?? "";
      const clean = sanitiseWithUrlContext(raw, mem.url);
      const prefix = mem.type ? `[${mem.type}] ` : "";
      const domain = mem.domain ? ` (${mem.domain})` : "";
      return truncate(`${prefix}${clean}${domain}`);
    })
    .filter(Boolean);

  // 3. Relevant references — memories tagged "reference" or type "reference"
  const relevantReferences: string[] = memories
    .filter(
      (m) =>
        m.type === "reference" ||
        (m.tags && m.tags.toLowerCase().includes("reference"))
    )
    .slice(0, 5)
    .map((mem) => {
      const raw = mem.summary ?? mem.content ?? mem.title ?? "";
      const clean = sanitiseWithUrlContext(raw, mem.url);
      return truncate(clean);
    })
    .filter(Boolean);

  // 4. Likely next step
  const likelyNextStep = inferLikelyNextStep(timelineEvents);

  // 5. Session summary (sanitised)
  let sessionSummary: string | null = null;
  if (session?.summary) {
    sessionSummary = sanitiseWithUrlContext(session.summary);
  } else if (session?.intent) {
    sessionSummary = `Intent: ${sanitiseWithUrlContext(session.intent)}`;
  } else if (session?.title) {
    sessionSummary = sanitiseWithUrlContext(session.title);
  }

  return {
    currentProject,
    currentTask,
    recentWork,
    relevantReferences,
    likelyNextStep,
    sessionSummary: sessionSummary ? truncate(sessionSummary, 300) : null,
    timestamp: new Date().toISOString(),
  };
}

// --------------- Format for AI ---------------

/**
 * Render a `ContextCapsule` as a human-readable (but
 * machine-parseable) text block suitable for inclusion in
 * an AI system prompt or chat context.
 */
export function formatContextForAI(capsule: ContextCapsule): string {
  const lines: string[] = [
    "╔══════════════════════════════════════════════════════╗",
    "║            CONTEXT CAPSULE — AI Memory               ║",
    "╚══════════════════════════════════════════════════════╝",
    "",
    `Timestamp : ${capsule.timestamp}`,
  ];

  if (capsule.currentProject) {
    lines.push(`Project   : ${capsule.currentProject}`);
  }
  if (capsule.currentTask) {
    lines.push(`Task      : ${capsule.currentTask}`);
  }

  if (capsule.sessionSummary) {
    lines.push("");
    lines.push("── Session Summary ──");
    lines.push(capsule.sessionSummary);
  }

  if (capsule.recentWork.length > 0) {
    lines.push("");
    lines.push("── Recent Work ──");
    capsule.recentWork.forEach((w, i) => {
      lines.push(`  ${i + 1}. ${w}`);
    });
  }

  if (capsule.relevantReferences.length > 0) {
    lines.push("");
    lines.push("── Relevant References ──");
    capsule.relevantReferences.forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r}`);
    });
  }

  lines.push("");
  lines.push("── Inferred Next Step ──");
  lines.push(`  ${capsule.likelyNextStep}`);

  lines.push("");
  lines.push("══════════════════════════════════════════════════════");

  return lines.join("\n");
}
