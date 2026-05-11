// ============================================================
// AI Cognitive Operating System — TypeScript Interfaces
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

// --------------- Auth Types ---------------

export type UserRole = "user" | "admin";
export type UserPlan = "free" | "pro" | "enterprise";

export interface UserPreferences {
  privacyMode?: boolean;
  aiModel?: string;
  trackingSettings?: {
    trackTabs?: boolean;
    trackSearches?: boolean;
    trackCode?: boolean;
  };
  [key: string]: unknown;
}

// --------------- Organization Types ---------------

export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type OrgPlan = "free" | "pro" | "enterprise";

export interface OrgMemberPermissions {
  memories?: "none" | "read_only" | "read_write";
  agents?: "none" | "read_only" | "read_write";
  vault?: "none" | "read_only" | "read_write";
  settings?: "none" | "read_only" | "read_write";
  [key: string]: unknown;
}

// --------------- Knowledge Graph Types ---------------

export type NodeType =
  | "project"
  | "concept"
  | "tab"
  | "person"
  | "file"
  | "repository"
  | "conversation"
  | "task"
  | "workflow"
  | "technology"
  | "decision";

export type EdgeType =
  | "related"
  | "caused-by"
  | "solved-by"
  | "referenced-in"
  | "continuation-of"
  | "depends-on"
  | "part-of"
  | "extends";

// --------------- Agent Types ---------------

export type AgentType =
  | "research"
  | "coding"
  | "summarization"
  | "timeline"
  | "curator"
  | "optimizer"
  | "connector"
  | "debugging";

export type AgentStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// --------------- Hybrid Memory Types ---------------

export type MemoryTier =
  | "short_term"
  | "long_term"
  | "episodic"
  | "semantic"
  | "procedural";

// --------------- Workflow Types ---------------

export type WorkflowType =
  | "coding_session"
  | "research_session"
  | "debugging"
  | "design"
  | "meeting"
  | "writing";

export type WorkflowStatus =
  | "active"
  | "interrupted"
  | "completed"
  | "abandoned";

// --------------- Productivity Types ---------------

export type InsightType =
  | "deep_work"
  | "distraction"
  | "context_switch"
  | "productive_pattern"
  | "inefficiency"
  | "suggestion";

// --------------- Import Types ---------------

export type ImportSource =
  | "github"
  | "notion"
  | "slack"
  | "linear"
  | "google_docs"
  | "vscode"
  | "discord"
  | "jira"
  | "figma";

export type ImportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

// --------------- Sync Types ---------------

export type SyncStatus = "synced" | "syncing" | "conflict" | "offline";

// --------------- Audit Types ---------------

export type AuditAction =
  | "memory_created"
  | "memory_deleted"
  | "vault_access"
  | "agent_run"
  | "settings_changed"
  | "member_added";

// ============================================================
// Prisma Model Interfaces
// ============================================================

// --------------- Auth & Accounts ---------------

export interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
  role: UserRole;
  plan: UserPlan;
  preferences?: string | null; // JSON string
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
  accounts: Account[];
  sessions: SessionToken[];
}

export interface Account {
  id: string;
  userId: string;
  user: User;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionToken {
  id: string;
  userId: string;
  user: User;
  token: string;
  expires: string;
  createdAt: string;
}

// --------------- Organization & Teams ---------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  plan: OrgPlan;
  maxMembers: number;
  maxStorage: number;
  createdAt: string;
  updatedAt: string;
  members: OrgMember[];
  workspaces: Workspace[];
  auditLogs: AuditLog[];
}

export interface OrgMember {
  id: string;
  organizationId: string;
  organization: Organization;
  userId: string;
  role: OrgRole;
  permissions?: string | null; // JSON string
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  organizationId?: string | null;
  organization?: Organization | null;
  userId?: string | null;
  isDefault: boolean;
  settings?: string | null; // JSON string
  createdAt: string;
  updatedAt: string;
}

// --------------- Sessions & Memories (Original) ---------------

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
  userId?: string | null;
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
  userId?: string | null;
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
  userId?: string | null;
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
  userId?: string | null;
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
  userId?: string | null;
  createdAt: string;
}

export interface SearchQuery {
  id: string;
  query: string;
  results?: string | null;
  filters?: string | null;
  userId?: string | null;
  createdAt: string;
}

// --------------- Knowledge Graph ---------------

export interface KnowledgeNode {
  id: string;
  userId?: string | null;
  type: NodeType;
  label: string;
  description?: string | null;
  metadata?: string | null; // JSON string
  importance: number;
  x?: number | null;
  y?: number | null;
  createdAt: string;
  updatedAt: string;
  edgesFrom: KnowledgeEdge[];
  edgesTo: KnowledgeEdge[];
}

export interface KnowledgeEdge {
  id: string;
  fromId: string;
  toId: string;
  from: KnowledgeNode;
  to: KnowledgeNode;
  type: EdgeType;
  strength: number;
  metadata?: string | null; // JSON string
  createdAt: string;
}

// --------------- AI Agents ---------------

export interface AgentExecution {
  id: string;
  userId?: string | null;
  agentType: AgentType;
  status: AgentStatus;
  input?: string | null; // JSON string
  output?: string | null; // JSON string
  error?: string | null;
  contextSize: number;
  duration: number;
  model?: string | null;
  sessionId?: string | null;
  memoryId?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

// --------------- Hybrid Memory ---------------

export interface HybridMemory {
  id: string;
  memoryId?: string | null;
  memoryTier: MemoryTier;
  importance: number;
  accessCount: number;
  lastAccessed: string;
  decayRate: number;
  isArchived: boolean;
  isDuplicate: boolean;
  parentMemoryId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --------------- Workflow State ---------------

export interface WorkflowState {
  id: string;
  userId?: string | null;
  type: WorkflowType;
  projectId?: string | null;
  status: WorkflowStatus;
  title?: string | null;
  description?: string | null;
  contextSnapshot?: string | null; // JSON string
  tabSnapshot?: string | null; // JSON string
  aiSummary?: string | null;
  nextSteps?: string | null; // JSON string
  startedAt: string;
  interruptedAt?: string | null;
  resumedAt?: string | null;
  completedAt?: string | null;
}

// --------------- Productivity ---------------

export interface ProductivityInsight {
  id: string;
  userId?: string | null;
  date: string;
  type: InsightType;
  title: string;
  description?: string | null;
  metric?: string | null; // JSON string
  action?: string | null;
  isRead: boolean;
  createdAt: string;
}

// --------------- Memory Import ---------------

export interface MemoryImport {
  id: string;
  userId?: string | null;
  source: ImportSource;
  sourceId?: string | null;
  externalUrl?: string | null;
  status: ImportStatus;
  itemsImported: number;
  itemsFailed: number;
  error?: string | null;
  metadata?: string | null; // JSON string
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --------------- Sync State ---------------

export interface SyncState {
  id: string;
  userId?: string | null;
  deviceId: string;
  deviceName?: string | null;
  lastSyncAt: string;
  syncVersion: number;
  status: SyncStatus;
  pendingOps: number;
}

// --------------- Audit Log ---------------

export interface AuditLog {
  id: string;
  organizationId?: string | null;
  organization?: Organization | null;
  userId?: string | null;
  action: AuditAction;
  resource?: string | null;
  resourceId?: string | null;
  details?: string | null; // JSON string
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

// ============================================================
// Utility / Parsed Types
// ============================================================

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

/** Parsed KnowledgeNode metadata */
export interface KnowledgeNodeMetadata {
  url?: string;
  domain?: string;
  icon?: string;
  color?: string;
  [key: string]: unknown;
}

/** Parsed KnowledgeEdge metadata */
export interface KnowledgeEdgeMetadata {
  context?: string;
  source?: string;
  [key: string]: unknown;
}

/** Parsed AgentExecution input */
export interface AgentExecutionInput {
  query?: string;
  context?: string;
  memories?: Array<{ id: string; relevance: number }>;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Parsed AgentExecution output */
export interface AgentExecutionOutput {
  result?: string;
  memories?: Array<{ id: string; content: string }>;
  suggestions?: string[];
  confidence?: number;
  [key: string]: unknown;
}

/** Parsed WorkflowState context snapshot */
export interface WorkflowContextSnapshot {
  activeTab?: { url: string; title: string };
  openTabs?: Array<{ url: string; title: string; domain: string }>;
  recentActions?: Array<{ type: string; timestamp: string; description: string }>;
  relevantMemories?: Array<{ id: string; content: string }>;
  [key: string]: unknown;
}

/** Parsed WorkflowState tab snapshot */
export interface WorkflowTabSnapshot {
  tabs: Array<{
    id?: string;
    url: string;
    title: string;
    domain: string;
    favIconUrl?: string;
  }>;
  activeTabId?: string;
}

/** Parsed WorkflowState next steps */
export interface WorkflowNextSteps {
  steps: Array<{
    description: string;
    priority?: "high" | "medium" | "low";
    completed?: boolean;
  }>;
  estimatedDuration?: number;
}

/** Parsed ProductivityInsight metric */
export interface ProductivityMetric {
  value: number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  comparison?: { previousValue: number; percentageChange: number };
}

/** Parsed MemoryImport metadata */
export interface MemoryImportMetadata {
  authInfo?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  syncSettings?: {
    autoSync?: boolean;
    syncInterval?: number;
    lastSyncCursor?: string;
  };
  [key: string]: unknown;
}

/** Parsed AuditLog details */
export interface AuditLogDetails {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  [key: string]: unknown;
}

// ============================================================
// AI Chat Types
// ============================================================

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

// ============================================================
// Agent Routing Types
// ============================================================

export interface AIRouteContext {
  query: string;
  intent: string;
  availableAgents: AgentType[];
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface AIModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
  fallbackModel?: string;
}

export interface AgentRoutingDecision {
  agentType: AgentType;
  confidence: number;
  reasoning: string;
  modelConfig: AIModelConfig;
  estimatedTokens: number;
}

// ============================================================
// Sidebar State
// ============================================================

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

// ============================================================
// Search State
// ============================================================

export interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  filters: SearchFilters;
  selectedMemoryId: string | null;
}

// ============================================================
// Store Input Types (for creating/updating)
// ============================================================

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

// ============================================================
// New Input Types (for creating/updating new models)
// ============================================================

// --- Organization Inputs ---

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  plan?: OrgPlan;
  maxMembers?: number;
}

export interface UpdateOrganizationInput {
  name?: string;
  description?: string;
  icon?: string;
  plan?: OrgPlan;
  maxMembers?: number;
  maxStorage?: number;
}

export interface AddOrgMemberInput {
  organizationId: string;
  userId: string;
  role?: OrgRole;
  permissions?: string;
}

export interface UpdateOrgMemberInput {
  role?: OrgRole;
  permissions?: string;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  organizationId?: string;
  userId?: string;
  isDefault?: boolean;
  settings?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
  settings?: string;
}

// --- Knowledge Graph Inputs ---

export interface CreateKnowledgeNodeInput {
  userId?: string;
  type: NodeType;
  label: string;
  description?: string;
  metadata?: string;
  importance?: number;
  x?: number;
  y?: number;
}

export interface UpdateKnowledgeNodeInput {
  type?: NodeType;
  label?: string;
  description?: string;
  metadata?: string;
  importance?: number;
  x?: number;
  y?: number;
}

export interface CreateKnowledgeEdgeInput {
  fromId: string;
  toId: string;
  type?: EdgeType;
  strength?: number;
  metadata?: string;
}

export interface UpdateKnowledgeEdgeInput {
  type?: EdgeType;
  strength?: number;
  metadata?: string;
}

// --- Agent Execution Inputs ---

export interface CreateAgentExecutionInput {
  userId?: string;
  agentType: AgentType;
  input?: string;
  model?: string;
  sessionId?: string;
  memoryId?: string;
}

export interface UpdateAgentExecutionInput {
  status?: AgentStatus;
  output?: string;
  error?: string;
  contextSize?: number;
  duration?: number;
  completedAt?: string | null;
}

// --- Hybrid Memory Inputs ---

export interface CreateHybridMemoryInput {
  memoryId?: string;
  memoryTier: MemoryTier;
  importance?: number;
  decayRate?: number;
  parentMemoryId?: string;
}

export interface UpdateHybridMemoryInput {
  memoryTier?: MemoryTier;
  importance?: number;
  accessCount?: number;
  decayRate?: number;
  isArchived?: boolean;
  isDuplicate?: boolean;
  parentMemoryId?: string;
}

// --- Workflow State Inputs ---

export interface CreateWorkflowStateInput {
  userId?: string;
  type: WorkflowType;
  projectId?: string;
  title?: string;
  description?: string;
  contextSnapshot?: string;
  tabSnapshot?: string;
  aiSummary?: string;
  nextSteps?: string;
}

export interface UpdateWorkflowStateInput {
  status?: WorkflowStatus;
  title?: string;
  description?: string;
  contextSnapshot?: string;
  tabSnapshot?: string;
  aiSummary?: string;
  nextSteps?: string;
  interruptedAt?: string | null;
  resumedAt?: string | null;
  completedAt?: string | null;
}

// --- Productivity Insight Inputs ---

export interface CreateProductivityInsightInput {
  userId?: string;
  date: string;
  type: InsightType;
  title: string;
  description?: string;
  metric?: string;
  action?: string;
}

export interface UpdateProductivityInsightInput {
  isRead?: boolean;
}

// --- Memory Import Inputs ---

export interface CreateMemoryImportInput {
  userId?: string;
  source: ImportSource;
  sourceId?: string;
  externalUrl?: string;
  metadata?: string;
}

export interface UpdateMemoryImportInput {
  status?: ImportStatus;
  itemsImported?: number;
  itemsFailed?: number;
  error?: string;
  metadata?: string;
  lastSyncAt?: string | null;
}

// --- Sync State Inputs ---

export interface CreateSyncStateInput {
  userId?: string;
  deviceId: string;
  deviceName?: string;
}

export interface UpdateSyncStateInput {
  deviceName?: string;
  lastSyncAt?: string;
  syncVersion?: number;
  status?: SyncStatus;
  pendingOps?: number;
}

// --- Audit Log Input ---

export interface CreateAuditLogInput {
  organizationId?: string;
  userId?: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}
