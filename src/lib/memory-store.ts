import { create } from "zustand";
import type {
  Session,
  Memory,
  MemoryRelation,
  TimelineEvent,
  Project,
  VaultItem,
  AIDailySummary,
  SearchResult,
  SearchFilters,
  SidebarView,
  AIChatMessage,
  CreateSessionInput,
  UpdateSessionInput,
  CreateMemoryInput,
  UpdateMemoryInput,
  CreateTimelineEventInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateMemoryRelationInput,
  CreateVaultItemInput,
  MemoryType,
  TimelineEventType,
  MemoryRelationType,
  VaultItemType,
} from "@/types";

// ============================================================
// Memory Store — Zustand State Management
// ============================================================

export interface MemoryStoreState {
  // ---- Session Slice ----
  sessions: Session[];
  currentSession: Session | null;
  setCurrentSession: (session: Session | null) => void;
  addSession: (input: CreateSessionInput & { id: string; startedAt: string }) => void;
  updateSession: (id: string, input: UpdateSessionInput) => void;
  removeSession: (id: string) => void;
  setSessions: (sessions: Session[]) => void;

  // ---- Memory Slice ----
  memories: Memory[];
  addMemory: (input: CreateMemoryInput & { id: string; createdAt: string; updatedAt: string }) => void;
  updateMemory: (id: string, input: UpdateMemoryInput) => void;
  removeMemory: (id: string) => void;
  setMemories: (memories: Memory[]) => void;
  filterMemoriesByType: (type: MemoryType) => Memory[];
  filterMemoriesByProject: (projectId: string) => Memory[];
  filterMemoriesBySession: (sessionId: string) => Memory[];
  getMemoryById: (id: string) => Memory | undefined;

  // ---- Memory Relations Slice ----
  memoryRelations: MemoryRelation[];
  addMemoryRelation: (input: CreateMemoryRelationInput & { id: string; createdAt: string }) => void;
  removeMemoryRelation: (id: string) => void;
  setMemoryRelations: (relations: MemoryRelation[]) => void;
  getRelationsForMemory: (memoryId: string) => MemoryRelation[];

  // ---- Timeline Slice ----
  timelineEvents: TimelineEvent[];
  addTimelineEvent: (input: CreateTimelineEventInput & { id: string; createdAt: string }) => void;
  removeTimelineEvent: (id: string) => void;
  setTimelineEvents: (events: TimelineEvent[]) => void;
  filterTimelineBySession: (sessionId: string) => TimelineEvent[];
  filterTimelineByType: (type: TimelineEventType) => TimelineEvent[];

  // ---- Project Slice ----
  projects: Project[];
  addProject: (input: CreateProjectInput & { id: string; createdAt: string; updatedAt: string }) => void;
  updateProject: (id: string, input: UpdateProjectInput) => void;
  removeProject: (id: string) => void;
  setProjects: (projects: Project[]) => void;
  getProjectById: (id: string) => Project | undefined;

  // ---- Vault Slice ----
  vaultItems: VaultItem[];
  addVaultItem: (input: CreateVaultItemInput & { id: string; createdAt: string; updatedAt: string }) => void;
  updateVaultItem: (id: string, input: Partial<CreateVaultItemInput>) => void;
  removeVaultItem: (id: string) => void;
  setVaultItems: (items: VaultItem[]) => void;
  filterVaultByType: (type: VaultItemType) => VaultItem[];
  filterVaultByDomain: (domain: string) => VaultItem[];

  // ---- AI Daily Summary Slice ----
  dailySummaries: AIDailySummary[];
  setDailySummaries: (summaries: AIDailySummary[]) => void;
  getSummaryByDate: (date: string) => AIDailySummary | undefined;

  // ---- Search Slice ----
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  searchFilters: SearchFilters;
  selectedMemoryId: string | null;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  setIsSearching: (searching: boolean) => void;
  setSearchFilters: (filters: SearchFilters) => void;
  setSelectedMemoryId: (id: string | null) => void;
  clearSearch: () => void;

  // ---- Sidebar Slice ----
  sidebarOpen: boolean;
  sidebarView: SidebarView;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarView: (view: SidebarView) => void;

  // ---- AI Chat Slice ----
  chatMessages: AIChatMessage[];
  chatIsLoading: boolean;
  chatError: string | null;
  addChatMessage: (message: AIChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  setChatError: (error: string | null) => void;
  clearChatMessages: () => void;
}

export const useMemoryStore = create<MemoryStoreState>((set, get) => ({
  // ========================================
  // Session Slice
  // ========================================
  sessions: [],
  currentSession: null,

  setCurrentSession: (session) =>
    set({ currentSession: session }),

  addSession: (input) =>
    set((state) => ({
      sessions: [
        {
          ...input,
          project: input.project ?? null,
          task: input.task ?? null,
          summary: input.summary ?? null,
          intent: input.intent ?? null,
          endedAt: null,
          isActive: true,
          tabCount: input.tabCount ?? 1,
          memories: [],
          timeline: [],
        },
        ...state.sessions,
      ],
      currentSession:
        state.currentSession === null
          ? {
              ...input,
              project: input.project ?? null,
              task: input.task ?? null,
              summary: input.summary ?? null,
              intent: input.intent ?? null,
              endedAt: null,
              isActive: true,
              tabCount: input.tabCount ?? 1,
              memories: [],
              timeline: [],
            }
          : state.currentSession,
    })),

  updateSession: (id, input) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...input } : s
      ),
      currentSession:
        state.currentSession?.id === id
          ? { ...state.currentSession, ...input }
          : state.currentSession,
    })),

  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSession:
        state.currentSession?.id === id ? null : state.currentSession,
    })),

  setSessions: (sessions) => set({ sessions }),

  // ========================================
  // Memory Slice
  // ========================================
  memories: [],

  addMemory: (input) =>
    set((state) => ({
      memories: [
        {
          ...input,
          sessionId: input.sessionId ?? null,
          session: null,
          type: input.type ?? "general",
          summary: input.summary ?? null,
          metadata: input.metadata ?? null,
          url: input.url ?? null,
          domain: input.domain ?? null,
          title: input.title ?? null,
          projectId: input.projectId ?? null,
          tags: input.tags ?? null,
          embedding: input.embedding ?? null,
          isSensitive: input.isSensitive ?? false,
          relatedFrom: [],
          relatedTo: [],
        },
        ...state.memories,
      ],
    })),

  updateMemory: (id, input) =>
    set((state) => ({
      memories: state.memories.map((m) =>
        m.id === id ? { ...m, ...input, updatedAt: new Date().toISOString() } : m
      ),
    })),

  removeMemory: (id) =>
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
      memoryRelations: state.memoryRelations.filter(
        (r) => r.fromId !== id && r.toId !== id
      ),
    })),

  setMemories: (memories) => set({ memories }),

  filterMemoriesByType: (type) =>
    get().memories.filter((m) => m.type === type),

  filterMemoriesByProject: (projectId) =>
    get().memories.filter((m) => m.projectId === projectId),

  filterMemoriesBySession: (sessionId) =>
    get().memories.filter((m) => m.sessionId === sessionId),

  getMemoryById: (id) => get().memories.find((m) => m.id === id),

  // ========================================
  // Memory Relations Slice
  // ========================================
  memoryRelations: [],

  addMemoryRelation: (input) =>
    set((state) => ({
      memoryRelations: [
        {
          ...input,
          type: input.type ?? "related",
          strength: input.strength ?? 1.0,
          from: {} as Memory,
          to: {} as Memory,
        },
        ...state.memoryRelations,
      ],
    })),

  removeMemoryRelation: (id) =>
    set((state) => ({
      memoryRelations: state.memoryRelations.filter((r) => r.id !== id),
    })),

  setMemoryRelations: (relations) => set({ memoryRelations: relations }),

  getRelationsForMemory: (memoryId) =>
    get().memoryRelations.filter(
      (r) => r.fromId === memoryId || r.toId === memoryId
    ),

  // ========================================
  // Timeline Slice
  // ========================================
  timelineEvents: [],

  addTimelineEvent: (input) =>
    set((state) => ({
      timelineEvents: [
        {
          ...input,
          sessionId: input.sessionId ?? null,
          session: null,
          url: input.url ?? null,
          domain: input.domain ?? null,
          metadata: input.metadata ?? null,
        },
        ...state.timelineEvents,
      ],
    })),

  removeTimelineEvent: (id) =>
    set((state) => ({
      timelineEvents: state.timelineEvents.filter((e) => e.id !== id),
    })),

  setTimelineEvents: (events) => set({ timelineEvents: events }),

  filterTimelineBySession: (sessionId) =>
    get().timelineEvents.filter((e) => e.sessionId === sessionId),

  filterTimelineByType: (type) =>
    get().timelineEvents.filter((e) => e.type === type),

  // ========================================
  // Project Slice
  // ========================================
  projects: [],

  addProject: (input) =>
    set((state) => ({
      projects: [
        {
          ...input,
          description: input.description ?? null,
          color: input.color ?? "#6366f1",
          icon: input.icon ?? null,
          isActive: true,
        },
        ...state.projects,
      ],
    })),

  updateProject: (id, input) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id
          ? { ...p, ...input, updatedAt: new Date().toISOString() }
          : p
      ),
    })),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    })),

  setProjects: (projects) => set({ projects }),

  getProjectById: (id) => get().projects.find((p) => p.id === id),

  // ========================================
  // Vault Slice
  // ========================================
  vaultItems: [],

  addVaultItem: (input) =>
    set((state) => ({
      vaultItems: [
        {
          ...input,
          domain: input.domain ?? null,
        },
        ...state.vaultItems,
      ],
    })),

  updateVaultItem: (id, input) =>
    set((state) => ({
      vaultItems: state.vaultItems.map((item) =>
        item.id === id
          ? { ...item, ...input, updatedAt: new Date().toISOString() }
          : item
      ),
    })),

  removeVaultItem: (id) =>
    set((state) => ({
      vaultItems: state.vaultItems.filter((item) => item.id !== id),
    })),

  setVaultItems: (items) => set({ vaultItems: items }),

  filterVaultByType: (type) =>
    get().vaultItems.filter((item) => item.type === type),

  filterVaultByDomain: (domain) =>
    get().vaultItems.filter((item) => item.domain === domain),

  // ========================================
  // AI Daily Summary Slice
  // ========================================
  dailySummaries: [],

  setDailySummaries: (summaries) => set({ dailySummaries: summaries }),

  getSummaryByDate: (date) =>
    get().dailySummaries.find((s) => s.date === date),

  // ========================================
  // Search Slice
  // ========================================
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  searchFilters: {},
  selectedMemoryId: null,

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSearchResults: (results) => set({ searchResults: results }),

  setIsSearching: (searching) => set({ isSearching: searching }),

  setSearchFilters: (filters) => set({ searchFilters: filters }),

  setSelectedMemoryId: (id) => set({ selectedMemoryId: id }),

  clearSearch: () =>
    set({
      searchQuery: "",
      searchResults: [],
      isSearching: false,
      searchFilters: {},
      selectedMemoryId: null,
    }),

  // ========================================
  // Sidebar Slice
  // ========================================
  sidebarOpen: true,
  sidebarView: "memories",

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setSidebarView: (view) => set({ sidebarView: view }),

  // ========================================
  // AI Chat Slice
  // ========================================
  chatMessages: [],
  chatIsLoading: false,
  chatError: null,

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  setChatLoading: (loading) => set({ chatIsLoading: loading }),

  setChatError: (error) => set({ chatError: error }),

  clearChatMessages: () =>
    set({ chatMessages: [], chatError: null }),
}));
