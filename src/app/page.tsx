'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  LayoutDashboard,
  Zap,
  FolderKanban,
  Clock,
  Search,
  Network,
  MessageSquare,
  Cpu,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Send,
  RefreshCw,
  Tag,
  Globe,
  FileText,
  Code2,
  Microscope,
  ListChecks,
  Link2,
  Bug,
  Bot,
  Activity,
  GitBranch,
  Database,
  Layers,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Key,
  Lock,
  Bell,
  Trash2,
  Copy,
  Download,
  RotateCcw,
  LogOut,
  Puzzle,
  Chrome,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

// ============================================================
// Types
// ============================================================

interface Memory {
  id: string
  type: string
  title: string | null
  content: string
  summary: string | null
  url: string | null
  domain: string | null
  tags: string[]
  isSensitive: boolean
  projectId: string | null
  sessionId: string | null
  createdAt: string
  session?: { id: string; title: string }
}

interface Session {
  id: string
  title: string
  project: string | null
  task: string | null
  intent: string | null
  summary: string | null
  isActive: boolean
  startedAt: string
  endedAt: string | null
  memoryCount: number
  timelineCount: number
}

interface TimelineEvent {
  id: string
  type: string
  title: string
  url: string | null
  domain: string | null
  metadata: string | null
  sessionId: string | null
  createdAt: string
  session?: { id: string; title: string }
}

interface Project {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  sessionCount: number
  memoryCount: number
}

interface ContextCapsule {
  timestamp: string
  currentSession: {
    id: string
    title: string
    task: string | null
    intent: string | null
    project: string | null
    startedAt: string
    memoryCount: number
  } | null
  currentProject: {
    id: string
    name: string
    description: string | null
    color: string | null
  } | null
  recentMemories: Array<{
    id: string
    type: string
    title: string | null
    summary: string
    url: string | null
    domain: string | null
    projectId: string | null
    createdAt: string
  }>
  todaysTimeline: Array<{
    id: string
    type: string
    title: string
    domain: string | null
    createdAt: string
  }>
  summary: {
    activeSessionTitle: string | null
    projectName: string | null
    recentMemoryCount: number
    todayEventCount: number
    hasSensitiveData: boolean
  }
}

interface GraphData {
  nodeCount: number
  edgeCount: number
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface GraphNode {
  id: string
  type: string
  label: string
}

interface GraphEdge {
  fromId: string
  toId: string
  type: string
  strength: number
}

interface AgentInfo {
  type: string
  name: string
  description: string
  capabilities: string[]
  model: string
  stats: { total: number; success: number; failed: number; avgDuration: number }
}

interface ExecutionRecord {
  taskId: string
  agentType: string
  status: string
  createdAt: string
  duration: number
  confidence: number
  tokensUsed: number
}

interface VaultItem {
  id: string
  type: string
  label: string
  domain: string | null
  createdAt: string
  updatedAt: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ============================================================
// Constants
// ============================================================

type ViewId =
  | 'dashboard'
  | 'current-work'
  | 'projects'
  | 'timeline'
  | 'memories'
  | 'search'
  | 'knowledge-graph'
  | 'ai-assistant'
  | 'agents'
  | 'vault'
  | 'extension'
  | 'settings'

const NAV_ITEMS: { id: ViewId; label: string; icon: React.ReactNode; highlight?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'extension', label: 'Install Extension', icon: <Puzzle size={18} />, highlight: true },
  { id: 'current-work', label: 'Current Work', icon: <Zap size={18} /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban size={18} /> },
  { id: 'timeline', label: 'Timeline', icon: <Clock size={18} /> },
  { id: 'memories', label: 'Memories', icon: <Brain size={18} /> },
  { id: 'search', label: 'Search', icon: <Search size={18} /> },
  { id: 'knowledge-graph', label: 'Knowledge Graph', icon: <Network size={18} /> },
  { id: 'ai-assistant', label: 'AI Assistant', icon: <MessageSquare size={18} /> },
  { id: 'agents', label: 'Agents', icon: <Cpu size={18} /> },
  { id: 'vault', label: 'Vault', icon: <Shield size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
]

const MEMORY_TYPE_ICONS: Record<string, React.ReactNode> = {
  general: <FileText size={14} />,
  code: <Code2 size={14} />,
  research: <Microscope size={14} />,
  decision: <ListChecks size={14} />,
  reference: <Globe size={14} />,
  snippet: <Code2 size={14} />,
}

const MEMORY_TYPE_COLORS: Record<string, string> = {
  general: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
  code: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
  research: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20',
  decision: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
  reference: 'text-pink-400 bg-pink-500/15 border-pink-500/20',
  snippet: 'text-orange-400 bg-orange-500/15 border-orange-500/20',
}

const NODE_COLORS: Record<string, string> = {
  memory: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
  session: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20',
  project: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
  domain: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
  tag: 'text-pink-400 bg-pink-500/15 border-pink-500/20',
  concept: 'text-orange-400 bg-orange-500/15 border-orange-500/20',
}

const agentIcons: Record<string, React.ReactNode> = {
  research: <Microscope size={16} />,
  coding: <Code2 size={16} />,
  summarization: <FileText size={16} />,
  timeline: <Clock size={16} />,
  curator: <ListChecks size={16} />,
  optimizer: <Zap size={16} />,
  connector: <Link2 size={16} />,
  debugging: <Bug size={16} />,
}

const agentColors: Record<string, string> = {
  research: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20',
  coding: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
  summarization: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
  timeline: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
  curator: 'text-rose-400 bg-rose-500/15 border-rose-500/20',
  optimizer: 'text-orange-400 bg-orange-500/15 border-orange-500/20',
  connector: 'text-pink-400 bg-pink-500/15 border-pink-500/20',
  debugging: 'text-red-400 bg-red-500/15 border-red-500/20',
}

// ============================================================
// Animation Variants
// ============================================================

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}

// ============================================================
// Helpers
// ============================================================

function formatTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <Skeleton className="h-4 w-3/4 bg-zinc-800/50" />
      <Skeleton className="h-3 w-full bg-zinc-800/50" />
      <Skeleton className="h-3 w-1/2 bg-zinc-800/50" />
    </div>
  )
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-xl p-10 flex flex-col items-center justify-center text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4 text-zinc-600">
        {icon}
      </div>
      <p className="text-sm font-medium text-zinc-400 mb-1">{title}</p>
      <p className="text-xs text-zinc-600 max-w-xs">{description}</p>
    </motion.div>
  )
}

// ============================================================
// GraphCanvas Component (mini SVG knowledge graph)
// ============================================================

function GraphCanvas({ nodes, edges, height = 300 }: { nodes: GraphNode[]; edges: GraphEdge[]; height?: number }) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-zinc-600">No graph data to visualize</p>
      </div>
    )
  }

  const canvasW = 800
  const canvasH = height

  // Simple force-directed layout approximation
  const positioned = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const radius = Math.min(canvasW, canvasH) * 0.35
    return {
      ...node,
      x: canvasW / 2 + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
      y: canvasH / 2 + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
    }
  })

  const nodeMap = new Map(positioned.map((n) => [n.id, n]))

  return (
    <svg viewBox={`0 0 ${canvasW} ${canvasH}`} className="w-full h-full">
      <defs>
        <radialGradient id="nodeGlow">
          <stop offset="0%" stopColor="rgba(139,92,246,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {edges.slice(0, 100).map((edge, i) => {
        const from = nodeMap.get(edge.fromId)
        const to = nodeMap.get(edge.toId)
        if (!from || !to) return null
        const opacity = Math.min(0.6, edge.strength * 0.3 + 0.1)
        return (
          <line
            key={`e-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={`rgba(139,92,246,${opacity})`}
            strokeWidth={0.8}
            className="dash-animate"
            strokeDasharray="4 4"
          />
        )
      })}
      {positioned.map((node) => {
        const colorClass = NODE_COLORS[node.type] || NODE_COLORS.concept
        const fillMatch = colorClass.match(/bg-(\w+)-500/)
        const fill = fillMatch ? `var(--color-${fillMatch[1]}-500, #8b5cf6)` : '#8b5cf6'
        return (
          <g key={node.id} className="graph-node">
            <circle cx={node.x} cy={node.y} r={18} fill="url(#nodeGlow)" opacity={0.5} />
            <circle cx={node.x} cy={node.y} r={6} fill={fill} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
            <text x={node.x} y={node.y + 16} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={8} fontWeight={500}>
              {node.label.length > 12 ? node.label.substring(0, 12) + '…' : node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function DashboardPage() {
  const [activeView, setActiveView] = useState<ViewId>('dashboard')
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showExtensionBanner, setShowExtensionBanner] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cortex_dismiss_ext_banner') !== 'true'
    }
    return true
  })

  // Dashboard data
  const [memories, setMemories] = useState<Memory[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [contextCapsule, setContextCapsule] = useState<ContextCapsule | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [executions, setExecutions] = useState<ExecutionRecord[]>([])
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([])

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isRecalling, setIsRecalling] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: string
    type: string
    title: string
    content: string
    score: number
    createdAt: string
    metadata?: Record<string, unknown>
  }> | null>(null)

  // AI Assistant state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')

  // Memories filter state
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<string>('all')
  const [memorySearch, setMemorySearch] = useState('')

  // Settings state
  const [settings, setSettings] = useState({
    trackBrowsing: true,
    autoCapture: true,
    sensitiveFilter: true,
    notifications: false,
    dataRetention: '90',
  })

  const chatEndRef = useRef<HTMLDivElement>(null)

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [memRes, sesRes, tlRes, projRes, ccRes, kgRes, agRes] = await Promise.all([
        fetch('/api/memories?limit=20').then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/sessions').then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/timeline?limit=15').then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/projects').then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/context-capsule').then((r) => r.json()).catch(() => ({ data: null })),
        fetch('/api/knowledge-graph').then((r) => r.json()).catch(() => ({ data: null })),
        fetch('/api/agents').then((r) => r.json()).catch(() => ({ data: { agents: [] } })),
      ])

      setMemories(Array.isArray(memRes.data) ? memRes.data : [])
      setSessions(Array.isArray(sesRes.data) ? sesRes.data : [])
      setTimelineEvents(Array.isArray(tlRes.data) ? tlRes.data : [])
      setProjects(Array.isArray(projRes.data) ? projRes.data : [])
      setContextCapsule(ccRes.data || null)
      setGraphData(kgRes.data || null)
      setAgents(Array.isArray(agRes.data?.agents) ? agRes.data.agents : [])
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/executions?limit=15')
      const json = await res.json()
      setExecutions(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      console.error('Failed to fetch executions:', err)
    }
  }, [])

  const fetchVault = useCallback(async () => {
    try {
      const res = await fetch('/api/vault')
      const json = await res.json()
      setVaultItems(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      console.error('Failed to fetch vault:', err)
    }
  }, [])

  const fetchMemoriesFiltered = useCallback(async (type?: string, query?: string) => {
    try {
      const params = new URLSearchParams()
      params.set('limit', '50')
      if (type && type !== 'all') params.set('type', type)
      if (query) params.set('q', query)
      const res = await fetch(`/api/memories?${params.toString()}`)
      const json = await res.json()
      setMemories(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      console.error('Failed to fetch memories:', err)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  useEffect(() => {
    if (activeView === 'agents') fetchExecutions()
    if (activeView === 'vault') fetchVault()
  }, [activeView, fetchExecutions, fetchVault])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  // ============================================================
  // Handlers
  // ============================================================

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchResults(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const json = await res.json()
      setSearchResults(json.data || [])
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const handleRecall = useCallback(async () => {
    if (!chatInput.trim()) return
    const userMsg: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setIsRecalling(true)

    try {
      const res = await fetch('/api/ai/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: chatInput.trim() }),
      })
      const json = await res.json()
      const data = json.data
      const responseText = typeof data === 'string'
        ? data
        : JSON.stringify(data, null, 2)
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: responseText, timestamp: new Date().toISOString() },
      ])
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date().toISOString() },
      ])
    } finally {
      setIsRecalling(false)
    }
  }, [chatInput])

  const handleMemoryFilter = useCallback(() => {
    fetchMemoriesFiltered(memoryTypeFilter, memorySearch)
  }, [memoryTypeFilter, memorySearch, fetchMemoriesFiltered])

  // ============================================================
  // Today's stats computed
  // ============================================================

  const todaySessions = sessions.filter((s) => isToday(s.startedAt))
  const todayMemories = memories.filter((m) => isToday(m.createdAt))
  const todayTimeline = (contextCapsule?.todaysTimeline || []).length
  const activeSessions = sessions.filter((s) => s.isActive)

  // ============================================================
  // View Renderers
  // ============================================================

  const renderDashboardView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      {/* Welcome Message */}
      <motion.div variants={staggerItem}>
        <h1 className="text-xl font-semibold text-zinc-100">
          Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Here&apos;s your cognitive workspace overview</p>
      </motion.div>

      {/* Install Extension Banner — always visible, dismissible */}
      {!isLoading && showExtensionBanner && (
        <motion.div
          variants={staggerItem}
          className="relative overflow-hidden rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/15 via-zinc-900/80 to-cyan-500/15 p-6"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
          <button
            onClick={() => { setShowExtensionBanner(false); localStorage.setItem('cortex_dismiss_ext_banner', 'true') }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            title="Dismiss"
          >
            <ChevronRight size={14} className="rotate-90" />
          </button>
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
              <Puzzle size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-zinc-100 mb-1">Install the Cortex Extension</h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
                Download the Chrome extension to start tracking your browsing, building memories, and getting AI-powered context. 
                Everything syncs back to this dashboard automatically.
              </p>
            </div>
            <Button
              onClick={() => setActiveView('extension')}
              className="shrink-0 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 transition-all duration-200 cursor-pointer"
            >
              <Download size={14} className="mr-2" /> Get the Extension
            </Button>
          </div>
        </motion.div>
      )}

      {/* Context Capsule */}
      <motion.div variants={staggerItem}>
        <div className="glow-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-violet-400" />
            <h2 className="text-sm font-medium text-zinc-200">Context Capsule</h2>
            <Badge className="ml-auto text-[9px] border-0 bg-violet-500/15 text-violet-400">
              LIVE
            </Badge>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-2/3 bg-zinc-800/50" />
              <Skeleton className="h-3 w-full bg-zinc-800/50" />
              <Skeleton className="h-3 w-4/5 bg-zinc-800/50" />
            </div>
          ) : contextCapsule?.currentSession ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-zinc-200">
                  {contextCapsule.currentSession.title}
                </span>
                {contextCapsule.currentSession.project && (
                  <Badge variant="outline" className="text-[9px] text-zinc-500 border-zinc-700/50 bg-transparent">
                    {contextCapsule.currentSession.project}
                  </Badge>
                )}
              </div>
              {contextCapsule.currentSession.task && (
                <p className="text-xs text-zinc-400 pl-4">{contextCapsule.currentSession.task}</p>
              )}
              {contextCapsule.currentSession.intent && (
                <p className="text-xs text-zinc-500 pl-4 italic">{contextCapsule.currentSession.intent}</p>
              )}
              <div className="flex items-center gap-4 pt-1">
                <span className="text-[10px] text-zinc-600">
                  {contextCapsule.currentSession.memoryCount} memories in session
                </span>
                <span className="text-[10px] text-zinc-600">
                  Started {formatTimeAgo(contextCapsule.currentSession.startedAt)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-2">
                <Sparkles size={18} className="text-zinc-600" />
              </div>
              <p className="text-xs text-zinc-500">No active session</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Start browsing to build your cognitive context</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Today's Summary Stats */}
      <motion.div variants={staggerItem} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Sessions Today', value: todaySessions.length, icon: <Zap size={14} />, color: 'text-violet-400' },
          { label: 'Memories Today', value: todayMemories.length, icon: <Brain size={14} />, color: 'text-cyan-400' },
          { label: 'Timeline Events', value: todayTimeline, icon: <Clock size={14} />, color: 'text-emerald-400' },
          { label: 'Active Projects', value: projects.filter((p) => p.isActive).length, icon: <FolderKanban size={14} />, color: 'text-amber-400' },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{stat.label}</span>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <p className="text-xl font-semibold text-zinc-100">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Active Sessions + Recent Memories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Sessions */}
        <motion.div variants={staggerItem}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Active Sessions</h3>
            <Button variant="ghost" size="sm" onClick={() => setActiveView('current-work')} className="text-zinc-500 hover:text-zinc-300 text-[10px] h-6 px-2">
              View All <ArrowRight size={10} className="ml-1" />
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div>
          ) : activeSessions.length === 0 ? (
            <EmptyState icon={<Clock size={22} />} title="No active sessions" description="The extension will track your work automatically." />
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {activeSessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="glass rounded-xl p-4 hover:bg-zinc-800/20 transition-all duration-200 cursor-pointer group">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-medium text-zinc-200 group-hover:text-white">{session.title}</span>
                    </div>
                    {session.task && <p className="text-xs text-zinc-500 pl-4 mb-2">{session.task}</p>}
                    <div className="flex items-center gap-3 text-[10px] text-zinc-600 pl-4">
                      {session.project && <span className="flex items-center gap-1"><FolderKanban size={9} />{session.project}</span>}
                      <span>{session.memoryCount} memories</span>
                      <span>{formatTimeAgo(session.startedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </motion.div>

        {/* Recent Memories */}
        <motion.div variants={staggerItem}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Recent Memories</h3>
            <Button variant="ghost" size="sm" onClick={() => setActiveView('memories')} className="text-zinc-500 hover:text-zinc-300 text-[10px] h-6 px-2">
              View All <ArrowRight size={10} className="ml-1" />
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div>
          ) : memories.length === 0 ? (
            <EmptyState icon={<Brain size={22} />} title="No memories yet" description="Start browsing to build your cognitive workspace." />
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {memories.slice(0, 8).map((memory) => (
                  <div key={memory.id} className="glass rounded-xl p-3 hover:bg-zinc-800/20 transition-all duration-200 cursor-pointer group">
                    <div className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 ${MEMORY_TYPE_COLORS[memory.type] || MEMORY_TYPE_COLORS.general}`}>
                        {MEMORY_TYPE_ICONS[memory.type] || MEMORY_TYPE_ICONS.general}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-300 truncate group-hover:text-white">
                          {memory.title || 'Untitled Memory'}
                        </p>
                        <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                          {memory.summary || memory.content.substring(0, 80)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-zinc-600">{formatTimeAgo(memory.createdAt)}</span>
                          {memory.domain && <span className="text-[9px] text-zinc-700">{memory.domain}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </motion.div>
      </div>

      {/* Knowledge Graph Preview */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Knowledge Graph</h3>
          <Button variant="ghost" size="sm" onClick={() => setActiveView('knowledge-graph')} className="text-zinc-500 hover:text-zinc-300 text-[10px] h-6 px-2">
            Explore <ArrowRight size={10} className="ml-1" />
          </Button>
        </div>
        <Card className="glass border-zinc-800/30">
          <CardContent className="p-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full bg-zinc-800/50 rounded-xl" />
            ) : !graphData || graphData.nodeCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
                  <Network size={20} className="text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-400 mb-1">Your knowledge graph is empty</p>
                <p className="text-xs text-zinc-600">It grows as you work and browse</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-[10px] text-zinc-500">{graphData.nodeCount} nodes</span>
                  <span className="text-[10px] text-zinc-500">{graphData.edgeCount} edges</span>
                </div>
                <div className="bg-zinc-950/50 rounded-xl border border-zinc-800/30 overflow-hidden">
                  <GraphCanvas nodes={graphData.nodes.slice(0, 60)} edges={graphData.edges.slice(0, 100)} height={260} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )

  const renderCurrentWorkView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Current Work</h2>
        <Button variant="outline" size="sm" onClick={fetchDashboardData} className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50">
          <RefreshCw size={12} className="mr-1.5" /> Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : sessions.length === 0 ? (
        <EmptyState icon={<Zap size={22} />} title="No sessions recorded" description="The extension will track your work automatically when you start browsing." />
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => (
            <motion.div key={session.id} variants={staggerItem} transition={{ delay: i * 0.03 }}>
              <Card className="glass border-zinc-800/30 hover:border-zinc-700/50 transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${session.isActive ? 'bg-emerald-500/15 border border-emerald-500/20' : 'bg-zinc-800/50 border border-zinc-700/30'}`}>
                      {session.isActive ? <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" /> : <Clock size={16} className="text-zinc-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-zinc-200">{session.title}</span>
                        {session.isActive && <Badge className="text-[9px] border-0 bg-emerald-500/15 text-emerald-400">ACTIVE</Badge>}
                      </div>
                      {session.task && <p className="text-xs text-zinc-400 mb-1">{session.task}</p>}
                      {session.project && (
                        <Badge variant="outline" className="text-[9px] text-zinc-500 border-zinc-700/50 bg-transparent mr-2">
                          <FolderKanban size={9} className="mr-1" />{session.project}
                        </Badge>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-600">
                        <span>{session.memoryCount} memories</span>
                        <span>{session.timelineCount} events</span>
                        <span>{formatTimeAgo(session.startedAt)}</span>
                        {session.endedAt && <span>Ended {formatTimeAgo(session.endedAt)}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )

  const renderProjectsView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Projects</h2>
        <Button variant="outline" size="sm" onClick={fetchDashboardData} className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50">
          <RefreshCw size={12} className="mr-1.5" /> Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : projects.length === 0 ? (
        <EmptyState icon={<FolderKanban size={22} />} title="No projects yet" description="Projects are auto-created from your browsing sessions. Start working to see them appear." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project, i) => (
            <motion.div key={project.id} variants={staggerItem} transition={{ delay: i * 0.04 }}>
              <Card className="glass border-zinc-800/30 hover:border-zinc-700/50 transition-all duration-200 hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border" style={{ background: `${project.color || '#6366f1'}20`, borderColor: `${project.color || '#6366f1'}30` }}>
                      <FolderKanban size={18} style={{ color: project.color || '#6366f1' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200 truncate">{project.name}</span>
                        {project.isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </div>
                      <p className="text-[10px] text-zinc-500">Created {formatTimeAgo(project.createdAt)}</p>
                    </div>
                  </div>
                  {project.description && <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{project.description}</p>}
                  <div className="flex items-center gap-4 text-[10px] text-zinc-600">
                    <span className="flex items-center gap-1"><Clock size={9} /> {project.sessionCount} sessions</span>
                    <span className="flex items-center gap-1"><Brain size={9} /> {project.memoryCount} memories</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )

  const renderTimelineView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Timeline</h2>
        <Button variant="outline" size="sm" onClick={fetchDashboardData} className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50">
          <RefreshCw size={12} className="mr-1.5" /> Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : timelineEvents.length === 0 ? (
        <EmptyState icon={<Clock size={22} />} title="No timeline events" description="Your browsing activity will be tracked automatically by the extension." />
      ) : (
        <div className="relative">
          <div className="absolute left-[18px] top-4 bottom-4 w-px bg-zinc-800/80" />
          <div className="space-y-2 pl-10">
            {timelineEvents.map((event, i) => (
              <motion.div key={event.id} variants={staggerItem} transition={{ delay: i * 0.03 }} className="relative">
                <div className="absolute -left-10 top-4 w-[9px] h-[9px] rounded-full border-2 border-zinc-700 bg-zinc-900" />
                <Card className="glass border-zinc-800/30 hover:bg-zinc-800/20 transition-all duration-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[9px] text-zinc-500 border-zinc-700/50 bg-transparent">
                        {event.type.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[9px] text-zinc-600">{formatTimeAgo(event.createdAt)}</span>
                    </div>
                    <p className="text-xs text-zinc-300">{event.title}</p>
                    {event.domain && <span className="text-[9px] text-zinc-600">{event.domain}</span>}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )

  const renderMemoriesView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Memories</h2>
        <Button variant="outline" size="sm" onClick={handleMemoryFilter} className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50">
          <RefreshCw size={12} className="mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={memoryTypeFilter} onValueChange={setMemoryTypeFilter}>
          <SelectTrigger className="h-9 w-40 bg-zinc-900/50 border-zinc-800/50 text-xs text-zinc-300">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all" className="text-zinc-300 text-xs">All Types</SelectItem>
            <SelectItem value="general" className="text-zinc-300 text-xs">General</SelectItem>
            <SelectItem value="code" className="text-zinc-300 text-xs">Code</SelectItem>
            <SelectItem value="research" className="text-zinc-300 text-xs">Research</SelectItem>
            <SelectItem value="decision" className="text-zinc-300 text-xs">Decision</SelectItem>
            <SelectItem value="reference" className="text-zinc-300 text-xs">Reference</SelectItem>
            <SelectItem value="snippet" className="text-zinc-300 text-xs">Snippet</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={memorySearch}
            onChange={(e) => setMemorySearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMemoryFilter()}
            placeholder="Filter memories..."
            className="h-9 pl-8 rounded-lg bg-zinc-900/50 border-zinc-800/50 text-xs text-zinc-300 placeholder:text-zinc-600"
          />
        </div>
      </div>

      {memories.length === 0 ? (
        <EmptyState icon={<Brain size={22} />} title="No memories found" description="No memories yet. Start browsing to build your cognitive workspace." />
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2">
            {memories.map((memory, i) => (
              <motion.div key={memory.id} variants={staggerItem} transition={{ delay: i * 0.03 }}>
                <Card className="glass border-zinc-800/30 hover:bg-zinc-800/20 transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${MEMORY_TYPE_COLORS[memory.type] || MEMORY_TYPE_COLORS.general}`}>
                        {MEMORY_TYPE_ICONS[memory.type] || MEMORY_TYPE_ICONS.general}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-zinc-200 truncate">{memory.title || 'Untitled Memory'}</span>
                          {memory.isSensitive && (
                            <Badge className="text-[9px] border-0 bg-red-500/15 text-red-400">
                              <EyeOff size={9} className="mr-0.5" />Sensitive
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{memory.summary || memory.content.substring(0, 150)}</p>
                        <div className="flex items-center flex-wrap gap-2 mt-2">
                          <span className="text-[9px] text-zinc-600">{formatTimeAgo(memory.createdAt)}</span>
                          {memory.domain && (
                            <span className="flex items-center gap-1 text-[9px] text-zinc-600">
                              <Globe size={8} /> {memory.domain}
                            </span>
                          )}
                          {memory.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {memory.tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-[8px] px-1.5 py-0 text-zinc-600 border-zinc-800/50 bg-transparent">
                                  {tag}
                                </Badge>
                              ))}
                              {memory.tags.length > 4 && (
                                <span className="text-[8px] text-zinc-700">+{memory.tags.length - 4}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}
    </motion.div>
  )

  const renderSearchView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-100">Search</h2>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search memories, sessions, timeline..."
            className="h-11 pl-10 rounded-xl bg-zinc-900/50 border-zinc-800/50 text-sm text-zinc-300 placeholder:text-zinc-600"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          className="h-11 px-6 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/20 hover:border-violet-500/30"
        >
          {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </Button>
      </div>

      {searchResults === null ? (
        <EmptyState icon={<Search size={22} />} title="Search your workspace" description="Find memories, sessions, and timeline events across all your data." />
      ) : searchResults.length === 0 ? (
        <EmptyState icon={<Search size={22} />} title="No results found" description="Try different keywords or a broader search." />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found</p>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {searchResults.map((result, i) => (
                <motion.div key={result.id} variants={staggerItem} transition={{ delay: i * 0.03 }}>
                  <Card className="glass border-zinc-800/30 hover:bg-zinc-800/20 transition-all duration-200 cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className={`text-[9px] ${
                          result.type === 'memory' ? 'text-violet-400 border-violet-500/20 bg-violet-500/10' :
                          result.type === 'session' ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10' :
                          'text-amber-400 border-amber-500/20 bg-amber-500/10'
                        }`}>
                          {result.type}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-600">{formatTimeAgo(result.createdAt)}</span>
                          <Badge className="text-[9px] border-0 bg-emerald-500/10 text-emerald-500">{Math.round(result.score * 10)}%</Badge>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-zinc-300 mb-0.5">{result.title}</p>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">{result.content}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </motion.div>
  )

  const renderKnowledgeGraphView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Knowledge Graph</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const res = await fetch('/api/knowledge-graph', { method: 'POST' })
              const json = await res.json()
              setGraphData(json.data)
            } catch (err) { console.error(err) }
          }}
          className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50"
        >
          <RotateCcw size={12} className="mr-1.5" /> Rebuild
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-96 w-full bg-zinc-800/50 rounded-xl" />
      ) : !graphData || graphData.nodeCount === 0 ? (
        <EmptyState icon={<Network size={22} />} title="Your knowledge graph is empty" description="It grows as you work. Browse, save memories, and connections will form automatically." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Nodes', value: graphData.nodeCount, icon: <Database size={14} />, color: 'text-violet-400' },
              { label: 'Edges', value: graphData.edgeCount, icon: <GitBranch size={14} />, color: 'text-cyan-400' },
              { label: 'Avg Connections', value: graphData.nodeCount > 0 ? (graphData.edgeCount / graphData.nodeCount).toFixed(1) : '0', icon: <Network size={14} />, color: 'text-emerald-400' },
              { label: 'Density', value: graphData.nodeCount > 1 ? ((2 * graphData.edgeCount) / (graphData.nodeCount * (graphData.nodeCount - 1))).toFixed(4) : '0', icon: <Layers size={14} />, color: 'text-amber-400' },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                  <span className={stat.color}>{stat.icon}</span>
                </div>
                <p className="text-lg font-semibold text-zinc-200">{stat.value}</p>
              </div>
            ))}
          </div>
          <Card className="glass border-zinc-800/30">
            <CardContent className="p-4">
              <div className="bg-zinc-950/50 rounded-xl border border-zinc-800/30 overflow-hidden">
                <GraphCanvas nodes={graphData.nodes.slice(0, 100)} edges={graphData.edges.slice(0, 200)} height={400} />
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-zinc-800/30">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Nodes</h3>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1.5">
                  {graphData.nodes.slice(0, 30).map((node) => (
                    <div key={node.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-800/20 transition-colors">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border text-[10px] ${NODE_COLORS[node.type] || NODE_COLORS.concept}`}>
                        {node.type.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-zinc-300 truncate flex-1">{node.label}</span>
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0 text-zinc-600 border-zinc-800/50 bg-transparent shrink-0">{node.type}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  )

  const renderAIAssistantView = () => (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">AI Assistant</h2>
      <Card className="glass border-zinc-800/30 flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: '400px' }}>
        {/* Chat messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center mb-4">
                  <MessageSquare size={22} className="text-violet-400" />
                </div>
                <p className="text-sm font-medium text-zinc-300 mb-1">Ask anything about your workspace</p>
                <p className="text-xs text-zinc-600 max-w-xs">I can recall memories, summarize sessions, and help you find information across your cognitive workspace.</p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {['What was I working on today?', 'Summarize my recent research', 'Find related code snippets'].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setChatInput(suggestion)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30 text-[10px] text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/70 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-violet-500/15 border border-violet-500/20'
                      : 'glass border-zinc-800/30'
                  }`}>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <span className="text-[9px] text-zinc-600 mt-1 block">{formatTimeAgo(msg.timestamp)}</span>
                  </div>
                </motion.div>
              ))
            )}
            {isRecalling && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="glass border-zinc-800/30 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-violet-400" />
                  <span className="text-xs text-zinc-500">Thinking...</span>
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-zinc-800/30">
          <form
            onSubmit={(e) => { e.preventDefault(); handleRecall() }}
            className="flex items-center gap-2"
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about your memories, sessions, or workspace..."
              disabled={isRecalling}
              className="flex-1 h-10 bg-zinc-900/50 border-zinc-800/50 text-sm text-zinc-300 placeholder:text-zinc-600"
            />
            <Button
              type="submit"
              disabled={isRecalling || !chatInput.trim()}
              size="icon"
              className="h-10 w-10 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/20"
            >
              {isRecalling ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </form>
        </div>
      </Card>
    </motion.div>
  )

  const renderAgentsView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">AI Agents</h2>
        <Button variant="outline" size="sm" onClick={() => { fetchDashboardData(); fetchExecutions() }} className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50">
          <RefreshCw size={12} className="mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <motion.div key={agent.type} variants={staggerItem}>
            <Card className="glass border-zinc-800/30 hover:border-zinc-700/50 transition-all duration-200 hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${agentColors[agent.type] || 'text-zinc-400 bg-zinc-500/15 border-zinc-500/20'}`}>
                    {agentIcons[agent.type] || <Bot size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 font-medium leading-tight">{agent.name}</p>
                    <p className="text-[9px] text-zinc-500">{agent.model}</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 line-clamp-2 mb-3">{agent.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {agent.capabilities.slice(0, 3).map((cap) => (
                    <Badge key={cap} variant="outline" className="text-[8px] px-1.5 py-0 text-zinc-500 border-zinc-700/50 bg-transparent">{cap}</Badge>
                  ))}
                  {agent.capabilities.length > 3 && (
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 text-zinc-600 border-zinc-800/50 bg-transparent">+{agent.capabilities.length - 3}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-[9px] mb-1">
                  <span className="text-zinc-600">{agent.stats.total} runs</span>
                  <span className="text-emerald-500">{agent.stats.total > 0 ? Math.round((agent.stats.success / agent.stats.total) * 100) : 0}% success</span>
                </div>
                <Progress value={agent.stats.total > 0 ? (agent.stats.success / agent.stats.total) * 100 : 0} className="h-1" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Executions */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Recent Executions</h3>
        {executions.length === 0 ? (
          <EmptyState icon={<Activity size={22} />} title="No executions yet" description="Execute an agent task to see execution history." />
        ) : (
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {executions.map((exec) => (
                <div key={exec.taskId} className="glass rounded-xl p-3 hover:bg-zinc-800/20 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${agentColors[exec.agentType] || 'text-zinc-400 bg-zinc-500/15 border-zinc-500/20'}`}>
                      {agentIcons[exec.agentType] || <Bot size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-zinc-300">{exec.agentType}</span>
                        <Badge className={`text-[9px] border-0 px-1.5 py-0 ${
                          exec.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' :
                          exec.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                          exec.status === 'running' ? 'bg-blue-500/15 text-blue-400' :
                          'bg-zinc-700/50 text-zinc-400'
                        }`}>{exec.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[9px] text-zinc-600">
                        <span>{formatDuration(exec.duration)}</span>
                        <span>{exec.tokensUsed} tokens</span>
                        <span>{exec.confidence > 0 ? `${Math.round(exec.confidence * 100)}%` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </motion.div>
  )

  const renderVaultView = () => (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Vault</h2>
        <Button variant="outline" size="sm" onClick={fetchVault} className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50">
          <RefreshCw size={12} className="mr-1.5" /> Refresh
        </Button>
      </div>
      <div className="glow-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-violet-400" />
          <span className="text-xs text-zinc-300 font-medium">AES-256 Encrypted Storage</span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">All vault items are encrypted with AES-256-GCM. Data is never stored in plaintext.</p>
      </div>
      {vaultItems.length === 0 ? (
        <EmptyState icon={<Shield size={22} />} title="Vault is empty" description="Securely store API keys, tokens, and credentials. Items are encrypted at rest." />
      ) : (
        <ScrollArea className="max-h-96">
          <div className="space-y-2">
            {vaultItems.map((item, i) => (
              <motion.div key={item.id} variants={staggerItem} transition={{ delay: i * 0.03 }}>
                <Card className="glass border-zinc-800/30 hover:bg-zinc-800/20 transition-all duration-200">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/15 border border-violet-500/20">
                        <Key size={14} className="text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-zinc-300">{item.label}</span>
                          <Badge variant="outline" className="text-[9px] text-zinc-500 border-zinc-700/50 bg-transparent">{item.type}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-zinc-600">
                          {item.domain && <span>{item.domain}</span>}
                          <span>Added {formatTimeAgo(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}
    </motion.div>
  )

  const renderExtensionView = () => (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Browser Extension</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Install the Cortex Chrome extension to unlock full browser memory tracking</p>
      </div>

      {/* Download Card */}
      <Card className="glass border-zinc-800/30 overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5" />
          <CardContent className="relative p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/25">
                <Puzzle size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-zinc-100 mb-1">Cortex Extension for Chrome</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  The extension runs in your browser, tracking your tabs, sessions, and content automatically. 
                  It captures memories, detects sensitive data, builds your knowledge graph, and syncs everything 
                  to this dashboard. Without it, you can still use the dashboard manually — but the extension 
                  makes Cortex truly powerful.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['Tab Tracking', 'Auto Memory Capture', 'Sensitive Data Detection', 'Session Management', 'Knowledge Graph', 'Cloud Sync'].map((feature) => (
                    <Badge key={feature} variant="outline" className="text-[10px] text-violet-400 border-violet-500/20 bg-violet-500/5">
                      {feature}
                    </Badge>
                  ))}
                </div>
                <a
                  href="/download/cortex-extension.zip"
                  download="cortex-extension.zip"
                >
                  <Button className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 transition-all duration-200 cursor-pointer">
                    <Download size={14} className="mr-2" /> Download Extension (.zip)
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Installation Steps */}
      <Card className="glass border-zinc-800/30">
        <CardContent className="p-6 space-y-5">
          <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Chrome size={14} className="text-cyan-400" /> Installation Steps
          </h3>
          <Separator className="bg-zinc-800/50" />
          <div className="space-y-5">
            {[
              {
                step: 1,
                title: 'Download the Extension',
                description: 'Click the download button above to get the extension zip file. It contains all the extension files needed for Chrome.',
              },
              {
                step: 2,
                title: 'Extract the ZIP File',
                description: 'Extract the downloaded zip to a folder on your computer. Remember where you put it — you\'ll need the folder path in the next step.',
              },
              {
                step: 3,
                title: 'Open Chrome Extensions',
                description: 'Open Chrome and go to chrome://extensions in your address bar. Alternatively, click the three-dot menu in Chrome, go to "Extensions" and then "Manage Extensions".',
              },
              {
                step: 4,
                title: 'Enable Developer Mode',
                description: 'In the top-right corner of the extensions page, toggle on "Developer mode". This reveals additional options for loading unpacked extensions.',
              },
              {
                step: 5,
                title: 'Load the Extension',
                description: 'Click the "Load unpacked" button that appears. Select the extracted extension folder. The Cortex icon should appear in your browser toolbar!',
              },
              {
                step: 6,
                title: 'Connect to Your Account',
                description: 'Click the Cortex extension icon, then click the settings gear. Enter your server URL and the same email/password you used to sign up on this website. The extension will sync all your browser data to your account.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-violet-400">{item.step}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-zinc-200 mb-1">{item.title}</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="glass border-zinc-800/30">
        <CardContent className="p-6 space-y-5">
          <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Activity size={14} className="text-emerald-400" /> How It Works After Installation
          </h3>
          <Separator className="bg-zinc-800/50" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: <Eye size={18} />,
                color: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
                title: 'Tracks Browsing',
                description: 'Monitors your tabs and navigation in the background. Detects page types (docs, code, social, AI tools) automatically.',
              },
              {
                icon: <Brain size={18} />,
                color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20',
                title: 'Builds Memories',
                description: 'Extracts content from pages you visit, creates searchable memories with tags, importance scores, and summaries.',
              },
              {
                icon: <Layers size={18} />,
                color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
                title: 'Syncs to Dashboard',
                description: 'Pushes everything to your account on this website. Your memories, timeline, sessions, and knowledge graph are all visible here.',
              },
            ].map((card) => (
              <div key={card.title} className="glass rounded-xl p-4 border border-zinc-800/30">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border mb-3 ${card.color}`}>
                  {card.icon}
                </div>
                <p className="text-xs font-medium text-zinc-200 mb-1">{card.title}</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card className="glass border-zinc-800/30">
        <CardContent className="p-6 space-y-5">
          <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-400" /> Troubleshooting
          </h3>
          <Separator className="bg-zinc-800/50" />
          <div className="space-y-3">
            {[
              {
                q: 'The extension icon doesn\'t appear in my toolbar',
                a: 'Click the puzzle piece icon in Chrome\'s toolbar, then find "Cortex" and click the pin icon next to it to keep it visible.',
              },
              {
                q: 'It says "Offline" in the extension popup',
                a: 'Go to the extension settings and make sure the server URL is correct. It should be the same URL as this website. Then enter your login credentials.',
              },
              {
                q: 'My browsing data isn\'t showing up on the dashboard',
                a: 'Make sure tracking is enabled in the extension (the toggle should be blue). Then click "Sync Now" to push your data to the server.',
              },
              {
                q: 'I see "Not authenticated" when trying to sync',
                a: 'Re-enter your email and password in the extension\'s settings. The token may have expired — signing in again will fix it.',
              },
            ].map((item) => (
              <div key={item.q}>
                <p className="text-xs font-medium text-zinc-300 mb-1">Q: {item.q}</p>
                <p className="text-[11px] text-zinc-500 pl-3 border-l-2 border-zinc-800">{item.a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  const renderSettingsView = () => (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>

      {/* Privacy Controls */}
      <Card className="glass border-zinc-800/30">
        <CardContent className="p-5 space-y-5">
          <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Shield size={14} className="text-violet-400" /> Privacy Controls
          </h3>
          <Separator className="bg-zinc-800/50" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-300">Track Browsing Activity</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Automatically capture navigation events</p>
              </div>
              <Switch
                checked={settings.trackBrowsing}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, trackBrowsing: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-300">Auto-Capture Memories</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Automatically create memories from content</p>
              </div>
              <Switch
                checked={settings.autoCapture}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, autoCapture: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-300">Sensitive Data Filter</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Automatically detect and protect sensitive information</p>
              </div>
              <Switch
                checked={settings.sensitiveFilter}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, sensitiveFilter: v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-300">Notifications</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Show desktop notifications for important events</p>
              </div>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, notifications: v }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card className="glass border-zinc-800/30">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Database size={14} className="text-cyan-400" /> Data Retention
          </h3>
          <Separator className="bg-zinc-800/50" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-300">Auto-delete after</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Memories older than this will be automatically removed</p>
            </div>
            <Select
              value={settings.dataRetention}
              onValueChange={(v) => setSettings((s) => ({ ...s, dataRetention: v }))}
            >
              <SelectTrigger className="h-9 w-28 bg-zinc-900/50 border-zinc-800/50 text-xs text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="30" className="text-zinc-300 text-xs">30 days</SelectItem>
                <SelectItem value="90" className="text-zinc-300 text-xs">90 days</SelectItem>
                <SelectItem value="180" className="text-zinc-300 text-xs">180 days</SelectItem>
                <SelectItem value="365" className="text-zinc-300 text-xs">1 year</SelectItem>
                <SelectItem value="never" className="text-zinc-300 text-xs">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="glass border-zinc-800/30">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Settings size={14} className="text-amber-400" /> Data Management
          </h3>
          <Separator className="bg-zinc-800/50" />
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50">
              <Download size={12} className="mr-1.5" /> Export All Data
            </Button>
            <Button variant="outline" className="border-red-500/20 text-red-400 text-xs hover:bg-red-500/10">
              <Trash2 size={12} className="mr-1.5" /> Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="glass border-zinc-800/30">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Cortex</p>
              <p className="text-[10px] text-zinc-500">AI-Powered Browser Memory v0.2.0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return renderDashboardView()
      case 'current-work': return renderCurrentWorkView()
      case 'projects': return renderProjectsView()
      case 'timeline': return renderTimelineView()
      case 'memories': return renderMemoriesView()
      case 'search': return renderSearchView()
      case 'knowledge-graph': return renderKnowledgeGraphView()
      case 'ai-assistant': return renderAIAssistantView()
      case 'agents': return renderAgentsView()
      case 'vault': return renderVaultView()
      case 'extension': return renderExtensionView()
      case 'settings': return renderSettingsView()
      default: return renderDashboardView()
    }
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen w-full flex">
      {/* Sidebar */}
      <aside
        className={`sidebar-glass fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-56' : 'w-16'
        }`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shrink-0">
            <Brain size={18} className="text-white" />
          </div>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Cortex</h1>
              <p className="text-[9px] text-zinc-600">AI Memory</p>
            </motion.div>
          )}
        </div>

        <Separator className="bg-zinc-800/40 mx-2" />

        {/* Navigation */}
        <ScrollArea className="flex-1 py-2 px-2">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`sidebar-nav-item w-full flex items-center gap-2.5 text-left ${
                  activeView === item.id ? 'active' : ''
                } ${item.highlight && !activeView?.includes(item.id) ? '!bg-gradient-to-r !from-violet-500/10 !to-cyan-500/5 !border !border-violet-500/20 !rounded-lg' : ''} ${!sidebarOpen ? 'justify-center px-0' : ''}`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className={`shrink-0 ${item.highlight ? 'text-violet-400' : 'text-zinc-400'}`}>{item.icon}</span>
                {sidebarOpen && (
                  <span className={`text-xs ${activeView === item.id ? 'text-zinc-200 font-medium' : item.highlight ? 'text-violet-300' : 'text-zinc-500'}`}>
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </ScrollArea>

        {/* User section */}
        {session?.user && sidebarOpen && (
          <div className="px-3 pb-2">
            <div className="glass rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                  {(session.user.name || session.user.email || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-zinc-300 truncate">{session.user.name || 'User'}</p>
                  <p className="text-[9px] text-zinc-600 truncate">{session.user.email}</p>
                </div>
              </div>
              <button
n                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/30 transition-colors text-zinc-500 hover:text-red-400 text-[10px]"
              >
                <LogOut size={12} />
                Sign Out
              </button>
            </div>
          </div>
        )}
        {!session?.user && sidebarOpen && (
          <div className="px-3 pb-2">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800/30 transition-colors text-zinc-500 hover:text-zinc-300 text-xs"
            >
              <LogOut size={12} />
              Sign In
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="p-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800/30 transition-colors text-zinc-500 hover:text-zinc-400"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            {sidebarOpen && <span className="text-[10px]">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 transition-all duration-300 min-h-screen ${
          sidebarOpen ? 'ml-56' : 'ml-16'
        }`}
      >
        <div className="max-w-5xl mx-auto px-6 py-6 pb-16">
          <AnimatePresence mode="wait">
            <motion.div key={activeView} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
