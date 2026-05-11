'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMemoryStore } from '@/lib/memory-store'
import {
  LayoutDashboard,
  Zap,
  FolderKanban,
  Clock,
  Brain,
  Search,
  MessageSquare,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  Lock,
  Unlock,
  Code2,
  BookOpen,
  GitBranch,
  Globe,
  FileText,
  Link2,
  ArrowRight,
  Sparkles,
  Activity,
  Database,
  Cpu,
  TrendingUp,
  Send,
  X,
  Filter,
  ChevronDown,
  Eye,
  EyeOff,
  Copy,
  Check,
  Key,
  RefreshCw,
  Download,
  Trash2,
  MoreHorizontal,
  Circle,
  Hash,
  AlertCircle,
  PanelLeftClose,
  PanelLeft,
  Bot,
  User,
  Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

// ============================================================
// Types
// ============================================================

type ViewType =
  | 'dashboard'
  | 'current-work'
  | 'projects'
  | 'timeline'
  | 'memories'
  | 'search'
  | 'ai-assistant'
  | 'vault'
  | 'settings'

interface NavItem {
  id: ViewType
  label: string
  icon: React.ReactNode
  badge?: number
}

// ============================================================
// Demo Data
// ============================================================

const demoSessions = [
  {
    id: 's1',
    project: 'Social Media App',
    projectColor: '#8b5cf6',
    task: 'Fixing profile synchronization issue between client and server',
    tabCount: 12,
    duration: '2h 34m',
    isActive: true,
  },
  {
    id: 's2',
    project: 'Portfolio Website',
    projectColor: '#06b6d4',
    task: 'Implementing dark mode toggle with CSS variables',
    tabCount: 7,
    duration: '1h 12m',
    isActive: true,
  },
  {
    id: 's3',
    project: 'API Gateway',
    projectColor: '#f59e0b',
    task: 'Adding rate limiting middleware for public endpoints',
    tabCount: 5,
    duration: '45m',
    isActive: false,
  },
]

const demoMemories = [
  {
    id: 'm1',
    type: 'code' as const,
    icon: <Code2 size={14} />,
    content: 'Implemented debounced search using useDebounce hook with 300ms delay. Pattern: const query = useDebounce(searchTerm, 300)',
    timestamp: '12 min ago',
    tags: ['react', 'hooks', 'performance'],
    tagColors: ['bg-violet-500/20 text-violet-300', 'bg-cyan-500/20 text-cyan-300', 'bg-amber-500/20 text-amber-300'],
  },
  {
    id: 'm2',
    type: 'research' as const,
    icon: <BookOpen size={14} />,
    content: 'Found that Prisma handles many-to-many relations implicitly. Need to use explicit many-to-many for additional fields on join table.',
    timestamp: '28 min ago',
    tags: ['prisma', 'database'],
    tagColors: ['bg-emerald-500/20 text-emerald-300', 'bg-rose-500/20 text-rose-300'],
  },
  {
    id: 'm3',
    type: 'decision' as const,
    icon: <GitBranch size={14} />,
    content: 'Decided to use Zustand over Redux for state management due to simpler API and smaller bundle size in this project scope.',
    timestamp: '1h ago',
    tags: ['architecture', 'state-management'],
    tagColors: ['bg-blue-500/20 text-blue-300', 'bg-purple-500/20 text-purple-300'],
  },
  {
    id: 'm4',
    type: 'reference' as const,
    icon: <Link2 size={14} />,
    content: 'Chrome extension docs: chrome.storage.local is async and has 10MB limit. Use IndexedDB for larger datasets.',
    timestamp: '2h ago',
    tags: ['chrome-ext', 'storage'],
    tagColors: ['bg-yellow-500/20 text-yellow-300', 'bg-indigo-500/20 text-indigo-300'],
  },
]

const demoProjects = [
  { id: 'p1', name: 'Social Media App', color: '#8b5cf6', description: 'Full-stack social platform with real-time messaging', sessions: 23, memories: 156, lastActive: '12 min ago' },
  { id: 'p2', name: 'Portfolio Website', color: '#06b6d4', description: 'Personal portfolio with blog and project showcase', sessions: 15, memories: 89, lastActive: '1h ago' },
  { id: 'p3', name: 'API Gateway', color: '#f59e0b', description: 'Microservices API gateway with auth and rate limiting', sessions: 31, memories: 203, lastActive: '45m ago' },
  { id: 'p4', name: 'ML Pipeline', color: '#10b981', description: 'Data preprocessing and model training pipeline', sessions: 8, memories: 47, lastActive: '3h ago' },
  { id: 'p5', name: 'DevOps Toolkit', color: '#ef4444', description: 'CI/CD automation and infrastructure management', sessions: 12, memories: 74, lastActive: '1d ago' },
  { id: 'p6', name: 'Design System', color: '#ec4899', description: 'Component library and design tokens', sessions: 19, memories: 112, lastActive: '6h ago' },
]

const demoTimeline = [
  { id: 't1', time: '2:34 PM', type: 'coding' as const, title: 'Wrote profile sync handler in auth.ts', project: 'Social Media App', color: '#8b5cf6' },
  { id: 't2', time: '2:18 PM', type: 'search' as const, title: 'Searched "Prisma many-to-many implicit vs explicit"', project: 'Social Media App', color: '#8b5cf6' },
  { id: 't3', time: '1:55 PM', type: 'decision' as const, title: 'Chose Zustand for client state management', project: 'Social Media App', color: '#8b5cf6' },
  { id: 't4', time: '1:30 PM', type: 'navigation' as const, title: 'Visited Tailwind CSS dark mode documentation', project: 'Portfolio Website', color: '#06b6d4' },
  { id: 't5', time: '1:12 PM', type: 'tab_opened' as const, title: 'Opened GitHub PR #147: Fix auth flow', project: 'Social Media App', color: '#8b5cf6' },
  { id: 't6', time: '12:45 PM', type: 'note_created' as const, title: 'Created note: API rate limiting strategy', project: 'API Gateway', color: '#f59e0b' },
  { id: 't7', time: '12:20 PM', type: 'coding' as const, title: 'Implemented JWT refresh token rotation', project: 'API Gateway', color: '#f59e0b' },
  { id: 't8', time: '11:50 AM', type: 'search' as const, title: 'Searched "express middleware composition pattern"', project: 'API Gateway', color: '#f59e0b' },
]

const demoVaultItems = [
  { id: 'v1', type: 'api_key' as const, label: 'OpenAI API Key', domain: 'api.openai.com', isLocked: true },
  { id: 'v2', type: 'token' as const, label: 'GitHub Personal Access Token', domain: 'github.com', isLocked: true },
  { id: 'v3', type: 'credential' as const, label: 'AWS IAM Credentials', domain: 'aws.amazon.com', isLocked: false },
  { id: 'v4', type: 'api_key' as const, label: 'Vercel Deployment Token', domain: 'vercel.com', isLocked: true },
  { id: 'v5', type: 'ssh_key' as const, label: 'GitHub SSH Key', domain: 'github.com', isLocked: false },
]

const graphNodes = [
  { id: 'n1', x: 200, y: 80, label: 'Auth Flow', color: '#8b5cf6', r: 18 },
  { id: 'n2', x: 100, y: 160, label: 'OAuth', color: '#06b6d4', r: 14 },
  { id: 'n3', x: 310, y: 150, label: 'JWT', color: '#f59e0b', r: 14 },
  { id: 'n4', x: 160, y: 240, label: 'Sessions', color: '#10b981', r: 16 },
  { id: 'n5', x: 280, y: 250, label: 'Tokens', color: '#ec4899', r: 12 },
  { id: 'n6', x: 380, y: 220, label: 'Refresh', color: '#f59e0b', r: 10 },
  { id: 'n7', x: 80, y: 280, label: 'Cookies', color: '#06b6d4', r: 10 },
  { id: 'n8', x: 220, y: 300, label: 'Middleware', color: '#8b5cf6', r: 15 },
  { id: 'n9', x: 340, y: 310, label: 'Guards', color: '#10b981', r: 11 },
  { id: 'n10', x: 140, y: 340, label: 'RBAC', color: '#ef4444', r: 12 },
]

const graphEdges = [
  { from: 'n1', to: 'n2' },
  { from: 'n1', to: 'n3' },
  { from: 'n2', to: 'n4' },
  { from: 'n3', to: 'n5' },
  { from: 'n3', to: 'n6' },
  { from: 'n4', to: 'n7' },
  { from: 'n4', to: 'n8' },
  { from: 'n5', to: 'n6' },
  { from: 'n8', to: 'n9' },
  { from: 'n8', to: 'n10' },
]

// ============================================================
// Framer Motion Variants
// ============================================================

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const cardVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

// ============================================================
// Navigation Items
// ============================================================

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'current-work', label: 'Current Work', icon: <Zap size={18} />, badge: 3 },
  { id: 'projects', label: 'Projects', icon: <FolderKanban size={18} /> },
  { id: 'timeline', label: 'Timeline', icon: <Clock size={18} /> },
  { id: 'memories', label: 'Memories', icon: <Brain size={18} />, badge: 247 },
  { id: 'search', label: 'Search', icon: <Search size={18} /> },
  { id: 'ai-assistant', label: 'AI Assistant', icon: <MessageSquare size={18} /> },
  { id: 'vault', label: 'Vault', icon: <Shield size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
]

// ============================================================
// Main Page Component
// ============================================================

export default function CortexDashboard() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [memoryFilter, setMemoryFilter] = useState<string>('all')
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'c1',
      role: 'assistant' as const,
      content: "Hello! I'm your AI memory assistant. I can help you find information from your browsing sessions, answer questions about your projects, or help you recall decisions you've made. What would you like to know?",
      timestamp: 'Just now',
    },
  ])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim()) return
    const userMsg = {
      id: `cm-${Date.now()}`,
      role: 'user' as const,
      content: chatInput,
      timestamp: 'Just now',
    }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')

    setTimeout(() => {
      const aiMsg = {
        id: `cm-${Date.now() + 1}`,
        role: 'assistant' as const,
        content: "Based on your recent sessions, I found that you were working on the profile synchronization issue in your Social Media App. You implemented a debounced search pattern and decided to use Zustand for state management. Would you like me to provide more details on any of these?",
        timestamp: 'Just now',
      }
      setChatMessages((prev) => [...prev, aiMsg])
    }, 1200)
  }, [chatInput])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ============================================================ */}
      {/* Sidebar                                                       */}
      {/* ============================================================ */}
      <motion.aside
        className="sidebar-glass flex flex-col h-full z-20 relative shrink-0"
        animate={{ width: sidebarCollapsed ? 64 : 280 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shrink-0">
            <Brain size={18} className="text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="font-semibold text-base tracking-tight text-white"
              >
                Cortex
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <Separator className="opacity-50" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`sidebar-nav-item w-full flex items-center gap-3 text-sm transition-all duration-200 ${
                activeView === item.id
                  ? 'active text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="shrink-0 w-5 flex items-center justify-center">{item.icon}</span>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-between flex-1 min-w-0"
                  >
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                        {item.badge}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        <Separator className="opacity-50" />

        {/* Bottom Section */}
        <div className="px-3 py-3 space-y-3 shrink-0">
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {/* Tracking Active Indicator */}
                <div className="flex items-center gap-2 px-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs text-zinc-400">Tracking Active</span>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-2 px-2">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Memories</p>
                    <p className="text-sm font-medium text-zinc-300">247</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Sessions</p>
                    <p className="text-sm font-medium text-zinc-300">8</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-200"
          >
            {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* ============================================================ */}
      {/* Main Content Area                                             */}
      {/* ============================================================ */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-6 py-6 pb-16">
          <AnimatePresence mode="wait">
            {/* ============ DASHBOARD VIEW ============ */}
            {activeView === 'dashboard' && (
              <motion.div
                key="dashboard"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                {/* Header */}
                <motion.div variants={staggerItem}>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Dashboard</h1>
                  <p className="text-sm text-zinc-500 mt-1">Welcome back. Here&apos;s your work overview.</p>
                </motion.div>

                {/* Context Capsule */}
                <motion.div variants={staggerItem}>
                  <ContextCapsule />
                </motion.div>

                {/* Today's Summary */}
                <motion.div variants={staggerItem}>
                  <TodaySummary />
                </motion.div>

                {/* Active Sessions Grid */}
                <motion.div variants={staggerItem}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Active Sessions</h2>
                      <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-700/50 bg-transparent">
                        3 active
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {demoSessions.map((session, i) => (
                        <motion.div
                          key={session.id}
                          variants={cardVariants}
                          initial="initial"
                          animate="animate"
                          transition={{ delay: i * 0.08 }}
                          whileHover={{ y: -2, transition: { duration: 0.2 } }}
                        >
                          <SessionCard session={session} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Recent Memories + Graph */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div variants={staggerItem}>
                    <RecentMemories />
                  </motion.div>
                  <motion.div variants={staggerItem}>
                    <MemoryGraph
                      nodes={graphNodes}
                      edges={graphEdges}
                      hoveredNode={hoveredNode}
                      setHoveredNode={setHoveredNode}
                    />
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* ============ CURRENT WORK VIEW ============ */}
            {activeView === 'current-work' && (
              <motion.div
                key="current-work"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Current Work</h1>
                  <p className="text-sm text-zinc-500 mt-1">Your active session timeline and details.</p>
                </div>

                {/* Active Session Detail */}
                <div className="glass rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <Circle size={12} fill="#8b5cf6" color="#8b5cf6" />
                    <h2 className="text-lg font-medium text-white">Social Media App</h2>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-[10px]">Active</Badge>
                  </div>
                  <p className="text-sm text-zinc-400">Fixing profile synchronization issue between client and server</p>

                  {/* Timeline */}
                  <div className="space-y-0">
                    {demoTimeline.slice(0, 6).map((event, i) => (
                      <TimelineItem key={event.id} event={event} isLast={i === 5} />
                    ))}
                  </div>
                </div>

                {/* Session Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Tabs Open', value: '12', icon: <Globe size={16} />, color: 'text-violet-400' },
                    { label: 'Duration', value: '2h 34m', icon: <Clock size={16} />, color: 'text-cyan-400' },
                    { label: 'Memories', value: '23', icon: <Brain size={16} />, color: 'text-amber-400' },
                  ].map((stat) => (
                    <div key={stat.label} className="glass rounded-xl p-4 flex items-center gap-3">
                      <div className={`${stat.color}`}>{stat.icon}</div>
                      <div>
                        <p className="text-lg font-semibold text-white">{stat.value}</p>
                        <p className="text-[11px] text-zinc-500">{stat.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ============ PROJECTS VIEW ============ */}
            {activeView === 'projects' && (
              <motion.div
                key="projects"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <motion.div variants={staggerItem}>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Projects</h1>
                  <p className="text-sm text-zinc-500 mt-1">All your tracked projects and workspaces.</p>
                </motion.div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {demoProjects.map((project, i) => (
                    <motion.div
                      key={project.id}
                      variants={staggerItem}
                      whileHover={{ y: -2, transition: { duration: 0.2 } }}
                    >
                      <div className="glass rounded-2xl p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer group">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: project.color }}
                            />
                            <h3 className="text-sm font-medium text-white group-hover:text-zinc-100">{project.name}</h3>
                          </div>
                          <MoreHorizontal size={14} className="text-zinc-600" />
                        </div>
                        <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{project.description}</p>
                        <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Activity size={10} />
                            {project.sessions} sessions
                          </span>
                          <span className="flex items-center gap-1">
                            <Brain size={10} />
                            {project.memories} memories
                          </span>
                          <span className="ml-auto">{project.lastActive}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ============ TIMELINE VIEW ============ */}
            {activeView === 'timeline' && (
              <motion.div
                key="timeline"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Timeline</h1>
                  <p className="text-sm text-zinc-500 mt-1">Chronological activity across all sessions.</p>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700/50 bg-transparent cursor-pointer hover:bg-white/[0.04]">Today</Badge>
                  <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-800/50 bg-transparent cursor-pointer hover:bg-white/[0.04]">Yesterday</Badge>
                  <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-800/50 bg-transparent cursor-pointer hover:bg-white/[0.04]">This Week</Badge>
                </div>

                <div className="glass rounded-2xl p-6">
                  <div className="space-y-0">
                    {demoTimeline.map((event, i) => (
                      <TimelineItem key={event.id} event={event} isLast={i === demoTimeline.length - 1} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ============ MEMORIES VIEW ============ */}
            {activeView === 'memories' && (
              <motion.div
                key="memories"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold text-white tracking-tight">Memories</h1>
                    <p className="text-sm text-zinc-500 mt-1">All captured memories and knowledge fragments.</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700/50 bg-transparent">
                    247 total
                  </Badge>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  {['all', 'code', 'research', 'decision', 'reference'].map((filter) => (
                    <Badge
                      key={filter}
                      className={`text-[10px] cursor-pointer transition-all duration-200 ${
                        memoryFilter === filter
                          ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                          : 'bg-transparent text-zinc-500 border-zinc-700/50 hover:bg-white/[0.04]'
                      }`}
                      onClick={() => setMemoryFilter(filter)}
                    >
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Badge>
                  ))}
                </div>

                {/* Memory List */}
                <div className="space-y-3">
                  {demoMemories.map((memory, i) => (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                      className="glass rounded-xl p-4 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 text-zinc-400">
                          {memory.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-300 leading-relaxed line-clamp-2">{memory.content}</p>
                          <div className="flex items-center gap-3 mt-2.5">
                            <span className="text-[10px] text-zinc-600">{memory.timestamp}</span>
                            <div className="flex items-center gap-1.5">
                              {memory.tags.map((tag, j) => (
                                <span
                                  key={j}
                                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${memory.tagColors[j]}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={14} className="text-zinc-700 group-hover:text-zinc-400 shrink-0 mt-1 transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ============ SEARCH VIEW ============ */}
            {activeView === 'search' && (
              <motion.div
                key="search"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Search</h1>
                  <p className="text-sm text-zinc-500 mt-1">Semantic search across all your memories and sessions.</p>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search memories, code snippets, decisions..."
                    className="h-12 pl-11 pr-4 rounded-xl bg-white/[0.03] border-white/[0.06] text-sm text-white placeholder:text-zinc-600 focus:border-violet-500/30 focus:ring-violet-500/20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <kbd className="hidden md:inline-flex items-center h-5 px-1.5 rounded border border-zinc-700/50 bg-zinc-800/50 text-[10px] text-zinc-500 font-mono">
                      ⌘K
                    </kbd>
                  </div>
                </div>

                {/* Search Results */}
                {searchQuery ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Showing results for &ldquo;{searchQuery}&rdquo;</p>
                    {demoMemories.slice(0, 3).map((memory, i) => (
                      <motion.div
                        key={`sr-${memory.id}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="glass rounded-xl p-4 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 text-violet-400">
                            {memory.icon}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-zinc-300">{memory.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className="bg-violet-500/10 text-violet-400 border-0 text-[9px]">
                                {memory.type}
                              </Badge>
                              <span className="text-[10px] text-zinc-600">{memory.timestamp}</span>
                              <span className="text-[10px] text-emerald-500">92% match</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
                      <Search size={20} className="text-zinc-600" />
                    </div>
                    <p className="text-sm text-zinc-400 mb-1">Search your memory</p>
                    <p className="text-xs text-zinc-600">Find code snippets, decisions, research notes, and more</p>
                  </div>
                )}

                {/* Recent Searches */}
                <div className="space-y-3">
                  <h3 className="text-xs text-zinc-500 uppercase tracking-wider">Recent Searches</h3>
                  {['debounce hook react', 'prisma many-to-many', 'zustand vs redux', 'chrome storage limits'].map(
                    (term, i) => (
                      <button
                        key={i}
                        onClick={() => setSearchQuery(term)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all duration-200 text-left group"
                      >
                        <Clock size={12} className="text-zinc-600" />
                        <span className="text-sm text-zinc-400 group-hover:text-zinc-300">{term}</span>
                      </button>
                    )
                  )}
                </div>
              </motion.div>
            )}

            {/* ============ AI ASSISTANT VIEW ============ */}
            {activeView === 'ai-assistant' && (
              <motion.div
                key="ai-assistant"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6 h-[calc(100vh-3rem)] flex flex-col"
              >
                <div className="shrink-0">
                  <h1 className="text-2xl font-semibold text-white tracking-tight">AI Assistant</h1>
                  <p className="text-sm text-zinc-500 mt-1">Ask questions about your work and browsing history.</p>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
                  {chatMessages.map((msg, i) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center shrink-0 border border-white/[0.06]">
                          <Bot size={14} className="text-violet-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-violet-500/15 text-violet-100 border border-violet-500/10'
                            : 'glass text-zinc-300'
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                          <User size={14} className="text-zinc-400" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="shrink-0 glass rounded-2xl p-2 flex items-center gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about your work..."
                    className="flex-1 h-10 px-4 rounded-xl bg-transparent border-0 text-sm text-white placeholder:text-zinc-600 focus-visible:ring-0"
                  />
                  <Button
                    onClick={handleSendMessage}
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/10 text-violet-400 hover:text-violet-300"
                  >
                    <Send size={14} />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ============ VAULT VIEW ============ */}
            {activeView === 'vault' && (
              <motion.div
                key="vault"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold text-white tracking-tight">Vault</h1>
                    <p className="text-sm text-zinc-500 mt-1">Encrypted credentials and sensitive data.</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-white/[0.04]">
                    <Key size={12} className="mr-1.5" />
                    Master Key
                  </Button>
                </div>

                <div className="glass rounded-2xl p-5 flex items-center gap-3 border border-amber-500/10 bg-amber-500/[0.02]">
                  <Shield size={16} className="text-amber-400" />
                  <div>
                    <p className="text-xs text-amber-300 font-medium">Encryption Active</p>
                    <p className="text-[11px] text-zinc-500">All vault items are encrypted with AES-256-GCM</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {demoVaultItems.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="glass rounded-xl p-4 flex items-center justify-between group hover:bg-white/[0.04] transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                          {item.isLocked ? (
                            <Lock size={14} className="text-zinc-500" />
                          ) : (
                            <Unlock size={14} className="text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-zinc-300">{item.label}</p>
                          <p className="text-[11px] text-zinc-600">{item.domain}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-white/[0.04] text-zinc-500 border-0 text-[9px]">{item.type.replace('_', ' ')}</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]">
                          {item.isLocked ? <Eye size={13} /> : <EyeOff size={13} />}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ============ SETTINGS VIEW ============ */}
            {activeView === 'settings' && (
              <motion.div
                key="settings"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6 max-w-2xl"
              >
                <div>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
                  <p className="text-sm text-zinc-500 mt-1">Configure your Cortex preferences.</p>
                </div>

                {/* Privacy Section */}
                <div className="glass rounded-2xl p-6 space-y-5">
                  <h2 className="text-sm font-medium text-white flex items-center gap-2">
                    <Shield size={14} className="text-zinc-400" />
                    Privacy
                  </h2>
                  {[
                    { label: 'Track browsing activity', desc: 'Automatically capture context from your browsing sessions', defaultChecked: true },
                    { label: 'Capture code snippets', desc: 'Detect and save code from code editor tabs', defaultChecked: true },
                    { label: 'Save form inputs', desc: 'Remember form data and inputs for later recall', defaultChecked: false },
                    { label: 'Include sensitive pages', desc: 'Track pages that contain password or payment fields', defaultChecked: false },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-zinc-300">{item.label}</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">{item.desc}</p>
                      </div>
                      <Switch defaultChecked={item.defaultChecked} />
                    </div>
                  ))}
                </div>

                {/* AI Section */}
                <div className="glass rounded-2xl p-6 space-y-5">
                  <h2 className="text-sm font-medium text-white flex items-center gap-2">
                    <Sparkles size={14} className="text-zinc-400" />
                    AI Configuration
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1.5 block">API Key</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="password"
                          defaultValue="sk-••••••••••••••••••••••••"
                          className="h-9 rounded-lg bg-white/[0.03] border-white/[0.06] text-sm text-zinc-300"
                        />
                        <Button variant="outline" size="sm" className="shrink-0 border-zinc-700/50 text-zinc-400 text-xs hover:bg-white/[0.04]">
                          Update
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 mb-1.5 block">Model</label>
                      <div className="flex items-center gap-2">
                        <Input
                          defaultValue="gpt-4o-mini"
                          className="h-9 rounded-lg bg-white/[0.03] border-white/[0.06] text-sm text-zinc-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Storage Section */}
                <div className="glass rounded-2xl p-6 space-y-5">
                  <h2 className="text-sm font-medium text-white flex items-center gap-2">
                    <Database size={14} className="text-zinc-400" />
                    Storage
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Local storage used</span>
                      <span className="text-xs text-zinc-500 font-mono">4.2 MB / 10 MB</span>
                    </div>
                    <Progress value={42} className="h-1.5 bg-white/[0.04]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-white/[0.04]">
                      <Download size={12} className="mr-1.5" />
                      Export Data
                    </Button>
                    <Button variant="outline" size="sm" className="border-red-500/20 text-red-400 text-xs hover:bg-red-500/10">
                      <Trash2 size={12} className="mr-1.5" />
                      Clear All Data
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

// ============================================================
// Sub-Components
// ============================================================

function ContextCapsule() {
  return (
    <motion.div
      className="glass rounded-2xl p-6 glow-border relative overflow-hidden"
      whileHover={{ scale: 1.005, transition: { duration: 0.3 } }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-500/5 to-transparent rounded-bl-full pointer-events-none" />

      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} className="text-violet-400" />
        <h2 className="text-xs font-medium text-violet-300 uppercase tracking-wider">Context Capsule</h2>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[11px] text-zinc-500 mb-0.5">Current Project</p>
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <Circle size={8} fill="#8b5cf6" color="#8b5cf6" />
            Social Media App
          </p>
        </div>

        <div>
          <p className="text-[11px] text-zinc-500 mb-0.5">Current Task</p>
          <p className="text-sm text-zinc-300">Fixing profile synchronization issue between client and server</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] text-zinc-500 mb-2">Recent Work</p>
            <ul className="space-y-1.5">
              {[
                'Implemented WebSocket connection retry logic',
                'Added optimistic UI updates for profile changes',
                'Fixed race condition in token refresh flow',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="text-zinc-600 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] text-zinc-500 mb-2">Relevant References</p>
            <ul className="space-y-1.5">
              {[
                { label: 'PR #147: Auth Flow Fix', url: '#' },
                { label: 'Socket.io Reconnection Docs', url: '#' },
                { label: 'React Query Optimistic Updates', url: '#' },
              ].map((ref, i) => (
                <li key={i}>
                  <a
                    href={ref.url}
                    className="flex items-center gap-1.5 text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors"
                  >
                    <ExternalLink size={10} />
                    {ref.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-2 border-t border-white/[0.04]">
          <p className="text-[11px] text-zinc-500 mb-1">Likely Next Step</p>
          <p className="text-xs text-zinc-400">
            <span className="text-emerald-400">→</span>{' '}
            Write integration tests for the profile sync WebSocket handler to verify edge cases with concurrent updates.
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function TodaySummary() {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} className="text-cyan-400" />
        <h2 className="text-xs font-medium text-cyan-300 uppercase tracking-wider">Today&apos;s Summary</h2>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed mb-5">
        You spent most of your time on the <span className="text-white font-medium">Social Media App</span>,
        focusing on fixing the profile synchronization. You also made progress on the{' '}
        <span className="text-white font-medium">Portfolio Website</span> dark mode implementation.
        Overall productive session with 3 active projects.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Sessions', value: '8', color: 'from-violet-500 to-violet-600' },
          { label: 'Tabs Tracked', value: '47', color: 'from-cyan-500 to-cyan-600' },
          { label: 'Memories', value: '23', color: 'from-amber-500 to-amber-600' },
          { label: 'Decisions', value: '4', color: 'from-emerald-500 to-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">{stat.label}</span>
              <span className="text-sm font-semibold text-white font-mono">{stat.value}</span>
            </div>
            <Progress
              value={Math.random() * 60 + 30}
              className="h-1 bg-white/[0.04]"
            />
          </div>
        ))}
      </div>

      <div>
        <p className="text-[11px] text-zinc-500 mb-2">Projects worked on today:</p>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { name: 'Social Media App', color: '#8b5cf6', pct: 65 },
            { name: 'Portfolio Website', color: '#06b6d4', pct: 20 },
            { name: 'API Gateway', color: '#f59e0b', pct: 15 },
          ].map((project) => (
            <div key={project.name} className="flex items-center gap-2">
              <Circle size={6} fill={project.color} color={project.color} />
              <span className="text-[11px] text-zinc-400">{project.name}</span>
              <span className="text-[10px] text-zinc-600 font-mono">{project.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session }: { session: typeof demoSessions[0] }) {
  return (
    <div className="glass rounded-2xl p-5 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Circle size={8} fill={session.projectColor} color={session.projectColor} />
          <h3 className="text-sm font-medium text-white">{session.project}</h3>
        </div>
        {session.isActive && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-500 mb-4 line-clamp-2 leading-relaxed">{session.task}</p>

      <div className="flex items-center gap-3 mb-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Globe size={10} />
          {session.tabCount} tabs
        </span>
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {session.duration}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full h-8 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.04] group-hover:border-violet-500/20 group-hover:text-violet-300 transition-all duration-200"
      >
        <Play size={10} className="mr-1.5" />
        Resume Session
      </Button>
    </div>
  )
}

function RecentMemories() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Recent Memories</h2>
        <button
          onClick={() => {}}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
        >
          View all <ArrowRight size={10} />
        </button>
      </div>

      <div className="space-y-2.5">
        {demoMemories.map((memory, i) => (
          <motion.div
            key={memory.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ x: 2, transition: { duration: 0.15 } }}
            className="glass rounded-xl px-4 py-3 flex items-start gap-3 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 text-zinc-500 group-hover:text-zinc-400 transition-colors">
              {memory.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{memory.content}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-zinc-600">{memory.timestamp}</span>
                {memory.tags.slice(0, 2).map((tag, j) => (
                  <span
                    key={j}
                    className={`text-[8px] px-1 py-0.5 rounded ${memory.tagColors[j]}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function MemoryGraph({
  nodes,
  edges,
  hoveredNode,
  setHoveredNode,
}: {
  nodes: typeof graphNodes
  edges: typeof graphEdges
  hoveredNode: string | null
  setHoveredNode: (id: string | null) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Memory Graph</h2>
        <Badge variant="outline" className="text-[10px] text-zinc-500 border-zinc-700/50 bg-transparent">
          10 nodes
        </Badge>
      </div>

      <div className="glass rounded-2xl p-4 overflow-hidden">
        <svg viewBox="0 0 460 380" className="w-full h-auto">
          {/* Background glow */}
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Edges */}
          {edges.map((edge) => {
            const from = nodes.find((n) => n.id === edge.from)
            const to = nodes.find((n) => n.id === edge.to)
            if (!from || !to) return null
            const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isHighlighted ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.06)'}
                strokeWidth={isHighlighted ? 1.5 : 0.8}
                className="transition-all duration-300"
              />
            )
          })}

          {/* Animated dashed connections */}
          {edges.slice(0, 4).map((edge) => {
            const from = nodes.find((n) => n.id === edge.from)
            const to = nodes.find((n) => n.id === edge.to)
            if (!from || !to) return null
            return (
              <line
                key={`dash-${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="rgba(139, 92, 246, 0.15)"
                strokeWidth={0.5}
                strokeDasharray="4 4"
                className="dash-animate"
              />
            )
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredNode === node.id
            return (
              <g
                key={node.id}
                className="graph-node"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Glow */}
                {isHovered && (
                  <circle cx={node.x} cy={node.y} r={node.r + 12} fill="url(#nodeGlow)" className="transition-all duration-300" />
                )}
                {/* Circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={`${node.color}20`}
                  stroke={node.color}
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all duration-300"
                />
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-zinc-300 text-[9px] pointer-events-none select-none font-medium"
                  style={{ fontSize: node.r > 14 ? 9 : 7 }}
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function TimelineItem({
  event,
  isLast,
}: {
  event: typeof demoTimeline[0]
  isLast: boolean
}) {
  const typeIcons: Record<string, React.ReactNode> = {
    coding: <Code2 size={12} />,
    search: <Search size={12} />,
    decision: <GitBranch size={12} />,
    navigation: <Globe size={12} />,
    tab_opened: <ExternalLink size={12} />,
    note_created: <FileText size={12} />,
  }

  return (
    <div className="flex gap-3">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-400"
          style={{ backgroundColor: `${event.color}15` }}
        >
          {typeIcons[event.type] || <Circle size={12} />}
        </div>
        {!isLast && <div className="w-px flex-1 bg-white/[0.04] my-1" />}
      </div>

      {/* Content */}
      <div className="pb-5 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm text-zinc-300">{event.title}</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
          <span>{event.time}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Circle size={4} fill={event.color} color={event.color} />
            {event.project}
          </span>
        </div>
      </div>
    </div>
  )
}
