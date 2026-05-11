# Cortex — AI Browser Memory Extension

## Project Summary

A production-grade AI-powered browser extension that acts as an intelligent memory system and context engine for the user's browser activity. Built as a complete full-stack system with a Next.js companion dashboard and Chrome MV3 browser extension.

## Architecture

### Next.js Dashboard (Port 3000)
- **Tech**: Next.js 16, TypeScript, TailwindCSS 4, shadcn/ui, Framer Motion, Zustand
- **Purpose**: Companion dashboard for viewing memories, timelines, projects, AI context, and vault
- **UI**: Dark-mode glassmorphism design inspired by Arc Browser, Raycast, Linear

### Chrome Browser Extension
- **Tech**: Chrome Manifest V3, Vanilla JS, CSS3
- **Purpose**: Tracks browser activity, extracts context, manages sessions, stores memories
- **Components**: Background service worker, content scripts, popup, sidebar panel

### Backend API
- **Tech**: Next.js API Routes, Prisma ORM, z-ai-web-dev-sdk
- **Purpose**: Memory management, AI recall, semantic search, encryption vault, context capsules

### Database
- **Tech**: SQLite via Prisma ORM
- **Models**: Session, Memory, MemoryRelation, TimelineEvent, Project, VaultItem, AIDailySummary, SearchQuery

---

## Files Created

### Dashboard (src/app/)
| File | Lines | Description |
|------|-------|-------------|
| `page.tsx` | 1,407 | Main dashboard with 9 views (Dashboard, Current Work, Projects, Timeline, Memories, Search, AI Assistant, Vault, Settings) |
| `layout.tsx` | Updated | Dark mode, ThemeProvider, Cortex branding |
| `globals.css` | Updated | Glassmorphism utilities, animations, custom scrollbars |

### API Routes (src/app/api/)
| File | Lines | Description |
|------|-------|-------------|
| `memories/route.ts` | 176 | CRUD for memories with filtering and search |
| `sessions/route.ts` | 86 | Session management with auto-end logic |
| `timeline/route.ts` | 138 | Timeline event tracking |
| `projects/route.ts` | 105 | Project CRUD |
| `search/route.ts` | 378 | Semantic text search with relevance scoring |
| `ai/recall/route.ts` | 141 | AI-powered context recall via z-ai-web-dev-sdk |
| `ai/summarize/route.ts` | 354 | AI summaries for sessions, days, projects |
| `vault/route.ts` | 136 | Encrypted vault item management |
| `vault/[id]/route.ts` | 132 | Vault item decrypt/retrieve/delete |
| `security/detect/route.ts` | 217 | Sensitive data pattern detection |
| `context-capsule/route.ts` | 169 | AI context capsule generation |

### Security (src/lib/security/)
| File | Lines | Description |
|------|-------|-------------|
| `detector.ts` | 559 | 16+ sensitive data pattern detectors, entropy analysis, content sanitizer |
| `vault.ts` | 150 | AES-256-GCM encryption/decryption |
| `index.ts` | 3 | Barrel exports |

### AI (src/lib/ai/)
| File | Lines | Description |
|------|-------|-------------|
| `context-builder.ts` | 258 | Context capsule builder with sanitization |

### Browser Extension (extension/)
| File | Lines | Description |
|------|-------|-------------|
| `manifest.json` | - | Chrome MV3 manifest with permissions |
| `background/index.js` | 1,373 | Service worker: tab tracking, session management, memory pipeline, search, privacy |
| `content/index.js` | 702 | Content scripts: page extraction, floating button, SPA navigation, text selection |
| `popup/index.html` | 575 | Compact popup with stats, search, controls |
| `popup/app.js` | - | Popup logic |
| `sidebar/index.html` | 1,043 | Full side panel with dashboard, timeline, memories, notes, settings |
| `sidebar/app.js` | - | Sidebar logic |
| `icons/` | - | Generated app icons (16, 48, 128, 1024px) |

### Core (src/)
| File | Lines | Description |
|------|-------|-------------|
| `types/index.ts` | - | TypeScript interfaces for all models + UI types |
| `lib/memory-store.ts` | 450 | Zustand store with 9 state slices |
| `lib/db.ts` | - | Prisma client |
| `prisma/schema.prisma` | - | 8 database models |

---

## Total: ~8,500+ lines of production-quality code

## Key Features Implemented

1. **Live Context Reading** — Tab tracking, URL monitoring, content extraction, page type detection
2. **Intelligent Session Understanding** — Auto-grouping tabs into work sessions, intent inference
3. **Automatic Workspace Grouping** — Domain-based workspace context with activity scoring
4. **Timeline Memory** — Complete chronological event log with session association
5. **Semantic Memory Engine** — Text-based search with relevance scoring, tag filtering
6. **AI Recall System** — z-ai-web-dev-sdk powered context reconstruction and Q&A
7. **Smart Summaries** — AI-generated daily, session, and project summaries
8. **Smart Tab Intelligence** — Duplicate detection, workspace creation, tab grouping
9. **Context Graph** — Visual SVG network graph with animated connections
10. **Selective Encryption Vault** — AES-256-GCM, 16+ sensitive pattern detectors, entropy analysis
11. **Privacy Protection** — Incognito ignore, sensitive URL blocking, content sanitization
12. **AI Context Capsules** — Sanitized, structured context for AI systems
13. **Browser Extension** — Full Chrome MV3 with background worker, content scripts, popup, sidebar
14. **Beautiful Dashboard** — Glassmorphism, Framer Motion animations, 9 views, responsive
