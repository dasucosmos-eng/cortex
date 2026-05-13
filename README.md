# Memora Bond — AI Browser Memory

An AI-powered memory bond that transforms your browser into a persistent intelligent workspace with memory, contextual understanding, and autonomous AI agents.

## Overview

Memora Bond continuously understands, organizes, remembers, and retrieves your work context across tabs, sessions, projects, research, coding, and workflows. It acts as your AI-powered memory bond — strengthening the connection between your work and your recall.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension (MV3)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Content  │  │ Popup    │  │ Sidebar  │  │Context │  │
│  │ Script   │  │          │  │ Panel    │  │ Menu   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       └──────────────┴──────────────┴────────────┘       │
│                         │                                │
│              ┌──────────▼──────────┐                     │
│              │  Background Worker  │                     │
│              │  • Tab Tracking     │                     │
│              │  • Session Mgmt     │                     │
│              │  • Memory Pipeline  │                     │
│              │  • Privacy Engine   │                     │
│              │  • Agent Bridge     │                     │
│              │  • Sync Module      │                     │
│              └──────────┬──────────┘                     │
└─────────────────────────┼───────────────────────────────┘
                          │ REST API
┌─────────────────────────┼───────────────────────────────┐
│              Next.js 16 Dashboard                        │
│  ┌──────────▼──────────────────────────────────────┐    │
│  │              API Routes (30+)                    │    │
│  │  • Memories  • Sessions  • Timeline             │    │
│  │  • AI Agents  • Knowledge Graph                 │    │
│  │  • Workflow Continuation  • Search               │    │
│  │  • Auth  • Organizations  • Sync                │    │
│  │  • Analytics  • Import  • Privacy               │    │
│  └──────────┬──────────────────────────────────────┘    │
│  ┌──────────▼──────────────────────────────────────┐    │
│  │           AI Engine                              │    │
│  │  • 8 Autonomous Agents  • Context Routing        │    │
│  │  • Knowledge Engine   • Memory Curation          │    │
│  │  • Workflow Continuation  • Predictive AI        │    │
│  └──────────┬──────────────────────────────────────┘    │
│  ┌──────────▼──────────────────────────────────────┐    │
│  │        SQLite Database (22 Models)               │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Dashboard | Next.js 16, React 19, TypeScript, TailwindCSS 4 |
| UI Components | shadcn/ui, Framer Motion, Lucide Icons |
| State Management | Zustand, TanStack Query |
| Browser Extension | Chrome Manifest V3, Vanilla JS |
| Database | SQLite via Prisma ORM |
| AI | z-ai-web-dev-sdk (GPT, Claude) |
| Auth | NextAuth.js v4 |
| Security | AES-256-GCM, Shannon Entropy Analysis |

## Key Features

### Memory & Context
- **Live Context Reading** — Tracks tabs, URLs, searches, coding sessions, research
- **Intelligent Session Understanding** — Infers current task, project, intent, workflow
- **Automatic Workspace Grouping** — Organizes tabs into projects and workflows
- **Timeline Memory** — Complete searchable chronological activity log
- **Semantic Memory Engine** — Embeddings, relationship graphs, topic clustering
- **AI Recall System** — "What was I doing yesterday?" — intelligent context reconstruction
- **Smart Summaries** — Session, daily, project, and coding summaries

### AI Agents (8 Types)
- **Research Agent** — Autonomous research and reference gathering
- **Coding Agent** — Code analysis and pattern detection
- **Summarization Agent** — Content compression and summarization
- **Timeline Agent** — Activity pattern analysis
- **Memory Curator** — Deduplication, compression, archival
- **Workflow Optimizer** — Productivity and efficiency suggestions
- **Knowledge Connector** — Cross-domain relationship building
- **Debugging Assistant** — Error pattern recognition and solutions

### Knowledge Graph
- Real-time neural graph with 8 node types and 8 edge types
- Dijkstra pathfinding, connected component clustering, PageRank ranking
- Interactive SVG visualization with animated connections

### Workflow Intelligence
- **Continuation Engine** — Detects interrupted work, suggests resumption steps
- **Predictive Assistance** — Recommends docs, detects repeated errors, preloads references
- **Productivity Detection** — Deep work tracking, distraction alerts, context switch analysis

### Security Architecture
- **Selective Encryption** — Only secrets are encrypted (AES-256-GCM), normal context stays searchable
- **16+ Sensitive Pattern Detectors** — OpenAI, Google, AWS, GitHub, Slack, Stripe, JWT, RSA, SSH, etc.
- **Shannon Entropy Analysis** — Flags high-entropy strings as potentially sensitive
- **Privacy Controls** — Incognito ignore, sensitive URL blocking, content sanitization
- **Privacy Transparency Dashboard** — See exactly what is stored and what AI can access

### Enterprise Features
- **Authentication** — Email/password with NextAuth.js, OAuth (Google, GitHub)
- **Organizations** — Team workspaces with role-based permissions
- **Audit Logging** — Complete audit trail of all sensitive operations
- **Cross-Device Sync** — Persistent memory across desktop, laptop, tablet
- **Memory Import** — Connectors for GitHub, Notion, Slack, Linear, Google Docs, VS Code, Discord, Jira, Figma

## Project Structure

```
├── extension/                  # Chrome Browser Extension (MV3)
│   ├── manifest.json           # Extension manifest
│   ├── background/index.js     # Service worker (2018 lines)
│   ├── content/index.js        # Content scripts (702 lines)
│   ├── popup/                  # Extension popup
│   ├── sidebar/                # Side panel UI
│   └── icons/                  # App icons
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Main dashboard (900+ lines)
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── globals.css         # Global styles & glassmorphism
│   │   └── api/                # 30+ API routes
│   │       ├── memories/       # Memory CRUD
│   │       ├── sessions/       # Session management
│   │       ├── timeline/       # Timeline events
│   │       ├── projects/       # Project management
│   │       ├── search/         # Semantic search
│   │       ├── agents/         # AI agent orchestration
│   │       ├── knowledge-graph/ # Knowledge graph engine
│   │       ├── workflow/       # Workflow continuation
│   │       ├── organizations/  # Team management
│   │       ├── sync/           # Cross-device sync
│   │       ├── import/         # Memory import connectors
│   │       ├── analytics/      # Productivity insights
│   │       ├── security/       # Sensitive data detection
│   │       ├── vault/          # Encrypted vault
│   │       ├── privacy/        # Privacy dashboard
│   │       ├── ai/             # AI recall, summarization, predictive
│   │       ├── memory-curation/ # Memory dedup/compression
│   │       ├── hybrid-memory/  # Multi-tier memory
│   │       ├── audit-log/      # Audit trail
│   │       └── context-capsule/ # AI context generation
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── agent-orchestrator.ts  # 8-agent orchestration
│   │   │   ├── agent-routers.ts       # Contextual AI routing
│   │   │   ├── workflow-continuation.ts # Interruption detection
│   │   │   ├── memory-curator.ts      # Memory curation
│   │   │   ├── knowledge-engine.ts    # Graph engine
│   │   │   └── context-builder.ts     # Context capsule builder
│   │   ├── security/
│   │   │   ├── detector.ts     # 16+ pattern detectors
│   │   │   ├── vault.ts        # AES-256-GCM encryption
│   │   │   └── index.ts
│   │   ├── auth.ts             # NextAuth configuration
│   │   ├── auth-helpers.ts     # Auth utilities
│   │   ├── db.ts               # Prisma client
│   │   ├── memory-store.ts     # Zustand store
│   │   └── utils.ts            # Utility functions
│   │
│   ├── types/index.ts          # TypeScript type system
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   └── providers.tsx       # Session + Theme providers
│   └── hooks/                  # React hooks
│
├── prisma/
│   └── schema.prisma           # 22 database models
│
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- Bun (recommended) or npm
- Chrome/Edge browser

### Install

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/memora-bond.git
cd memora-bond

# Install dependencies
bun install

# Set up database
bun run db:push

# Start the development server
bun run dev
```

### Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` directory

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL="file:./db/custom.db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

## Database Models (22)

| Category | Models |
|---|---|
| Auth | User, Account, SessionToken |
| Core | Session, Memory, MemoryRelation, TimelineEvent, Project |
| Security | VaultItem |
| AI | AIDailySummary, SearchQuery, AgentExecution |
| Knowledge | KnowledgeNode, KnowledgeEdge |
| Cognition | HybridMemory, WorkflowState |
| Enterprise | Organization, OrgMember, Workspace, AuditLog |
| Platform | ProductivityInsight, MemoryImport, SyncState |

## Stats

| Metric | Value |
|---|---|
| Total Files | 115 |
| Lines of Code | 21,955 |
| API Routes | 30+ |
| Database Models | 22 |
| AI Agents | 8 |
| UI Views | 13 |
| Import Connectors | 9 |
| Sensitive Patterns | 16+ |

## License

MIT
