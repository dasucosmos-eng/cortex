// ============================================================
// AI Browser Memory Extension — TypeScript Interfaces
// ============================================================

// --------------- Enums / Union Types ---------------

export type MemoryType =
  | "general"
  | "code"
  | "research"
  | "decision"
  | "reference"
  | "snippet";

export type MemoryRelationType =
  | "related"
  | "depends"
  | "extends"
  | "contrasts"
  | "references";

export type TimelineEventType =
  | "tab_opened"
  | "tab_closed"
  | "search"
  | "navigation"
  | "coding"
  | "decision"
  | "note_created";

export type VaultItemType =
  | "api_key"
  | "token"
  | "credential"
  | "certificate"
  | "ssh_key";

// --------------- Prisma Model Interfaces ---------------

export interface Session {
  id: string;
  title: string;
  project?: string | null;
  task?: string | null;
  summary?: string | null;
  intent?: string | null;
  startedAt: string;
  endedAt?: string | null;
  isActive: boolean;
  tabCount: number;
  memories: Memory[];
  timeline: TimelineEvent[];
}

export interface Memory {
  id: string;
  sessionId?: string | null;
  session?: Session | null;
  type: MemoryType;
  content: string;
  summary?: string | null;
  metadata?: string | null;
  url?: string | null;
  domain?: string | null;
  title?: string | null;
  projectId?: string | null;
  tags?: string | null;
  embedding?: string | null;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
  relatedFrom: MemoryRelation[];
  relatedTo: MemoryRelation[];
}

export interface MemoryRelation {
  id: string;
  fromId: string;
  toId: string;
  from: Memory;
  to: Memory;
  type: MemoryRelationType;
  strength: number;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  sessionId?: string | null;
  session?: Session | null;
  type: TimelineEventType;
  title: string;
  url?: string | null;
  domain?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VaultItem {
  id: string;
  type: VaultItemType;
  label: string;
  encryptedData: string;
  domain?: string | null;
  iv: string;
  authTag: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIDailySummary {
  id: string;
  date: string;
  summary: string;
  topics?: string | null;
  projects?: string | null;
  stats?: string | null;
  createdAt: string;
}

export interface SearchQuery {
  id: string;
  query: string;
  results?: string | null;
  filters?: string | null;
  createdAt: string;
}

// --------------- Utility / Parsed Types ---------------

/** Parsed JSON structures for fields stored as JSON strings in the DB. */

export interface MemoryMetadata {
  language?: string;
  framework?: string;
  filePath?: string;
  lineNumbers?: [number, number];
  screenshotUrl?: string;
  copiedFrom?: string;
  [key: string]: unknown;
}

export interface ParsedTags {
  tags: string[];
}

export interface TimelineEventMetadata {
  tabId?: number;
  previousUrl?: string;
  searchTerm?: string;
  searchEngine?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface AIDailySummaryTopics {
  topics: string[];
}

export interface AIDailySummaryProjects {
  projects: Array<{
    name: string;
    sessionCount: number;
    memoryCount: number;
  }>;
}

export interface AIDailySummaryStats {
  sessionsCreated: number;
  memoriesCreated: number;
  decisionsMade: number;
  topDomains: Array<{ domain: string; count: number }>;
}

export interface SearchFilters {
  type?: MemoryType[];
  domain?: string[];
  projectId?: string[];
  dateRange?: { start: string; end: string };
  isSensitive?: boolean;
  tags?: string[];
}

export interface SearchResult {
  memory: Memory;
  score: number;
  highlights?: string[];
}

// --------------- AI Chat Types ---------------

export type AIChatRole = "user" | "assistant" | "system";

export interface AIChatMessage {
  id: string;
  role: AIChatRole;
  content: string;
  timestamp: string;
  memoryIds?: string[];
}

export interface AIChatState {
  messages: AIChatMessage[];
  isLoading: boolean;
  error: string | null;
}

// --------------- Sidebar State ---------------

export type SidebarView =
  | "memories"
  | "timeline"
  | "projects"
  | "vault"
  | "settings";

export interface SidebarState {
  isOpen: boolean;
  activeView: SidebarView;
  width: number;
}

// --------------- Search State ---------------

export interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  filters: SearchFilters;
  selectedMemoryId: string | null;
}

// --------------- Store Input Types (for creating/updating) ---------------

export interface CreateSessionInput {
  title: string;
  project?: string;
  task?: string;
  summary?: string;
  intent?: string;
  tabCount?: number;
}

export interface UpdateSessionInput {
  title?: string;
  project?: string;
  task?: string;
  summary?: string;
  intent?: string;
  endedAt?: string | null;
  isActive?: boolean;
  tabCount?: number;
}

export interface CreateMemoryInput {
  sessionId?: string;
  type?: MemoryType;
  content: string;
  summary?: string;
  metadata?: string;
  url?: string;
  domain?: string;
  title?: string;
  projectId?: string;
  tags?: string;
  embedding?: string;
  isSensitive?: boolean;
}

export interface UpdateMemoryInput {
  sessionId?: string;
  type?: MemoryType;
  content?: string;
  summary?: string;
  metadata?: string;
  url?: string;
  domain?: string;
  title?: string;
  projectId?: string;
  tags?: string;
  embedding?: string;
  isSensitive?: boolean;
}

export interface CreateTimelineEventInput {
  sessionId?: string;
  type: TimelineEventType;
  title: string;
  url?: string;
  domain?: string;
  metadata?: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export interface CreateMemoryRelationInput {
  fromId: string;
  toId: string;
  type?: MemoryRelationType;
  strength?: number;
}

export interface CreateVaultItemInput {
  type: VaultItemType;
  label: string;
  encryptedData: string;
  domain?: string;
  iv: string;
  authTag: string;
}
