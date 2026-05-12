# Cortex — AI Cognitive Operating System

## Evolution Summary

Transformed from a browser memory extension into a next-generation AI-powered cognitive operating system. The browser evolves from "a collection of tabs" into "a persistent intelligent workspace with memory, contextual understanding, and autonomous AI agents."

---

## Architecture Overview

### Next.js 16 Dashboard
- **Tech**: Next.js 16, TypeScript, TailwindCSS 4, shadcn/ui, Framer Motion, Zustand, NextAuth
- **UI**: Dark glassmorphism design with 13 navigation views, responsive layout
- **Views**: Dashboard, Current Work, Teams, Projects, Analytics, Timeline, Memories, Search, Knowledge Graph, AI Assistant, Agents, Vault, Settings

### Chrome Browser Extension (MV3)
- **Tech**: Chrome Manifest V3, Vanilla JS, CSS3
- **Components**: Background service worker (2018 lines), content scripts, popup (640 lines), sidebar (1333 lines)
- **Features**: Tab tracking, session management, auth bridge, sync module, agent bridge, multi-modal capture

### Backend API (30+ routes)
- **Tech**: Next.js API Routes, Prisma ORM, z-ai-web-dev-sdk
- **AI**: Agent orchestration, contextual routing, workflow continuation, memory curation, knowledge engine

### Database (22 Prisma models)
- Auth: User, Account, SessionToken
- Core: Session, Memory, MemoryRelation, TimelineEvent, Project
- Security: VaultItem
- AI: AIDailySummary, SearchQuery, AgentExecution
- Knowledge: KnowledgeNode, KnowledgeEdge
- Cognition: HybridMemory, WorkflowState
- Enterprise: Organization, OrgMember, Workspace, AuditLog
- Platform: ProductivityInsight, MemoryImport, SyncState

---

## System Statistics

| Metric | Value |
|---|---|
| Total Files | 115 |
| Total Lines of Code | 21,955 |
| API Routes | 30+ |
| Prisma Models | 22 |
| Agent Types | 8 |
| UI Views | 13 |
| Import Connectors | 9 |

---

## Files Created/Modified

### Database & Types
- `prisma/schema.prisma` — 22 models
- `src/types/index.ts` — Complete type system

### Authentication
- `src/lib/auth.ts` — NextAuth configuration
- `src/lib/auth-helpers.ts` — Auth utilities
- `src/app/api/auth/[...nextauth]/route.ts` — Auth API
- `src/components/providers.tsx` — SessionProvider wrapper

### AI Core Engine
- `src/lib/ai/agent-orchestrator.ts` — 8-agent orchestration system
- `src/lib/ai/agent-routers.ts` — Contextual AI routing
- `src/lib/ai/workflow-continuation.ts` — Interruption detection & resumption
- `src/lib/ai/memory-curator.ts` — Memory deduplication, compression, archiving
- `src/lib/ai/knowledge-engine.ts` — Graph construction, pathfinding, clustering
- `src/lib/ai/context-builder.ts` — AI context capsule generation

### Security
- `src/lib/security/detector.ts` — 16+ sensitive pattern detectors
- `src/lib/security/vault.ts` — AES-256-GCM encryption
- `src/lib/security/index.ts` — Barrel exports

### API Routes (30+)
- Core: memories, sessions, timeline, projects, search
- AI: ai/recall, ai/summarize, ai/predictive
- Agents: agents, agents/executions, agents/[id]
- Knowledge: knowledge-graph, knowledge-graph/search
- Workflow: workflow/continuation
- Enterprise: organizations, organizations/[id], organizations/[id]/members
- Platform: sync, import, import/[id], import/connectors, memory-curation, hybrid-memory, audit-log
- Security: security/detect, vault, vault/[id], privacy/dashboard
- Analytics: analytics/productivity, analytics/daily-summary
- Context: context-capsule

### Dashboard UI
- `src/app/page.tsx` — Main dashboard with 13 views
- `src/app/layout.tsx` — Dark mode, providers, metadata
- `src/app/globals.css` — Glassmorphism, animations, custom scrollbars

### Browser Extension
- `extension/manifest.json` — MV3 manifest
- `extension/background/index.js` — Service worker (2018 lines)
- `extension/content/index.js` — Content scripts (702 lines)
- `extension/popup/index.html` + `app.js` — Popup (640 + 418 lines)
- `extension/sidebar/index.html` + `app.js` — Side panel (1333 + 908 lines)
- `extension/icons/` — Custom AI brain icons

---

## Key Capabilities Implemented

### 1. Continuous Cognitive Memory Engine
- Persistent evolving memory graph with 22 data models
- Knowledge nodes and edges connecting all activity
- Entity extraction, pathfinding (Dijkstra), clustering, PageRank ranking

### 2. AI Workflow Continuation Engine
- Automatic interruption detection (30min inactivity threshold)
- Full context snapshot at interruption point
- AI-powered resumption suggestions with completeness scoring
- One-click workflow resume

### 3. Multi-Modal Memory System
- Screenshot capture via chrome.tabs.captureVisibleTab
- Image processing for visual memory
- Voice note capture placeholder
- Unified semantic memory from all formats

### 4. AI Project Intelligence
- Architecture memory, tech stack, coding patterns, decisions
- Active workflows, known issues, recent decisions tracking
- Project-level context capsules

### 5. AI Agent System (8 Agents)
- Research Agent, Coding Agent, Summarization Agent
- Timeline Agent, Memory Curator, Workflow Optimizer
- Knowledge Connector, Debugging Assistant
- Priority-based task queue, multi-agent chaining

### 6. Contextual AI Routing System
- 7 AI contexts: coding, summarization, reasoning, embedding, creative, analysis, conversation
- Auto-routing based on content analysis
- Privacy-level model selection (normal/elevated/maximum)

### 7. Real-Time Knowledge Graph
- 8 node types, 8 edge types
- Force-directed SVG visualization
- Animated particles along edges
- Interactive hover tooltips

### 8. AI-Ready Context Capsule Engine
- Compressed relevant work context
- Semantic meaning preservation
- Secret sanitization
- Token-limit-aware formatting

### 9. Enterprise-Grade Account System
- NextAuth.js with credentials provider
- Organization workspaces, team management
- Role-based permissions (owner, admin, member, viewer)
- Audit logging

### 10. Cross-Device Cognitive Sync
- Device registration and identification
- Incremental version-based conflict resolution
- Periodic auto-sync (5-minute intervals)
- Pending operations queue

### 11. Memory Import System
- 9 connectors: GitHub, Notion, Slack, Linear, Google Docs, VS Code, Discord, Jira, Figma
- Import configuration and status tracking
- Deduplication-aware merge with existing memories

### 12. Intelligent Productivity Detection
- Deep work tracking
- Distraction detection
- Context switching analysis
- Workflow inefficiency identification
- AI-powered optimization suggestions

### 13. AI Memory Curation
- Duplicate detection (Jaccard similarity)
- Repetitive memory compression
- Low-importance archival
- Hierarchical memory organization (type → project → topic)
- Importance scoring (0-10) based on recency, access, connections

### 14. Advanced Privacy System
- Privacy transparency dashboard
- Memory visibility controls
- Selective forgetting/deletion
- AI access logging
- Encrypted memory layers

### 15. Hybrid Memory Architecture
- 5 tiers: short-term, long-term, episodic, semantic, procedural
- Importance decay rates
- Access tracking and promotion/demotion
- Archive management

### 16. AI Predictive Assistance
- Suggested documentation
- Unfinished work detection
- Repeated error patterns
- Preloaded references from knowledge graph
- Architecture improvement suggestions

### 17. Security Architecture
- 16+ sensitive pattern detectors (OpenAI, Google, AWS, GitHub, Slack, Stripe, JWT, RSA, SSH, DB strings, credit cards, OAuth, .env)
- Shannon entropy analysis (threshold ≥ 4.5)
- AES-256-GCM encryption vault
- Content sanitization for AI context
- Privacy controls (incognito ignore, sensitive URL blocking)
