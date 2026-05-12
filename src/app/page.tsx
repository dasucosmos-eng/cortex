'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Bot,
  Cpu,
  GitBranch,
  Search,
  FileText,
  Clock,
  Layers,
  Activity,
  Zap,
  ChevronRight,
  Play,
  RotateCcw,
  Sparkles,
  Network,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Database,
  Workflow,
  Lightbulb,
  Target,
  TrendingUp,
  MessagesSquare,
  Code2,
  Microscope,
  ListChecks,
  Wrench,
  Link2,
  Bug,
  Filter,
  Send,
  Square,
  Trash2,
  ExternalLink,
  Circle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

// ============================================================
// Types
// ============================================================

interface AgentInfo {
  type: string
  name: string
  description: string
  capabilities: string[]
  model: string
  stats: {
    total: number
    success: number
    failed: number
    avgDuration: number
  }
}

interface ExecutionRecord {
  taskId: string
  agentType: string
  status: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  duration: number
  confidence: number
  tokensUsed: number
  result?: {
    output: Record<string, unknown>
    followUpActions?: string[]
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
  metadata?: Record<string, unknown>
}

interface GraphEdge {
  fromId: string
  toId: string
  type: string
  strength: number
}

interface WorkflowSuggestion {
  sessionId: string
  type: string
  title: string
  tabsCount: number
  memoriesCount: number
  lastActivityAt: string
  timeSinceInterruption: number
}

interface ContinuationData {
  sessionId: string
  workflowType: string
  title: string
  timeElapsed: string
  completenessScore: number
  suggestedNextSteps: string[]
  contextCapsule: string
  tabsToRestore: Array<{ url: string; title: string; domain: string }>
}

// ============================================================
// Agent Icons Map
// ============================================================

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
  animate: { transition: { staggerChildren: 0.05 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}

// ============================================================
// Main Component
// ============================================================

export default function AgentOrchestrationPage() {
  const [activeTab, setActiveTab] = useState('agents')
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [executions, setExecutions] = useState<ExecutionRecord[]>([])
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [workflowSuggestions, setWorkflowSuggestions] = useState<WorkflowSuggestion[]>([])
  const [continuationResult, setContinuationResult] = useState<ContinuationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isRebuildingGraph, setIsRebuildingGraph] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string>('research')
  const [taskInput, setTaskInput] = useState('')
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null)
  const [graphQuery, setGraphQuery] = useState('')

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      fetchAgents(),
      fetchExecutions(),
      fetchGraphData(),
      fetchWorkflowSuggestions(),
    ]).finally(() => setIsLoading(false))
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      const json = await res.json()
      setAgents(json.data.agents || [])
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    }
  }, [])

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/executions?limit=15')
      const json = await res.json()
      setExecutions(json.data || [])
    } catch (err) {
      console.error('Failed to fetch executions:', err)
    }
  }, [])

  const fetchGraphData = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge-graph')
      const json = await res.json()
      setGraphData(json.data)
    } catch (err) {
      console.error('Failed to fetch graph:', err)
    }
  }, [])

  const fetchWorkflowSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow/continuation')
      const json = await res.json()
      setWorkflowSuggestions(json.data.suggestions || [])
    } catch (err) {
      console.error('Failed to fetch workflow suggestions:', err)
    }
  }, [])

  const handleExecuteAgent = useCallback(async () => {
    if (!taskInput.trim()) return
    setIsExecuting(true)
    setExecutionResult(null)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: selectedAgent,
          input: taskInput,
          priority: 'medium',
        }),
      })
      const json = await res.json()
      setExecutionResult(json.data)
      fetchExecutions()
      fetchAgents()
    } catch (err) {
      console.error('Execution failed:', err)
      setExecutionResult({ error: 'Execution failed' })
    } finally {
      setIsExecuting(false)
    }
  }, [selectedAgent, taskInput, fetchExecutions, fetchAgents])

  const handleRebuildGraph = useCallback(async () => {
    setIsRebuildingGraph(true)
    try {
      const res = await fetch('/api/knowledge-graph', { method: 'POST' })
      const json = await res.json()
      setGraphData(json.data)
    } catch (err) {
      console.error('Graph rebuild failed:', err)
    } finally {
      setIsRebuildingGraph(false)
    }
  }, [])

  const handleResumeWorkflow = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch('/api/workflow/continuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const json = await res.json()
      setContinuationResult(json.data)
    } catch (err) {
      console.error('Resume failed:', err)
    }
  }, [])

  const handleSearchGraph = useCallback(async () => {
    if (!graphQuery.trim()) {
      fetchGraphData()
      return
    }
    try {
      const res = await fetch(`/api/knowledge-graph/search?q=${encodeURIComponent(graphQuery)}`)
      const json = await res.json()
      setGraphData(json.data)
    } catch (err) {
      console.error('Graph search failed:', err)
    }
  }, [graphQuery, fetchGraphData])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTimeSince = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) return `${hours}h ${minutes}m ago`
    return `${minutes}m ago`
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
                Agent Orchestration
              </h1>
              <p className="text-sm text-zinc-500">
                AI agent coordination, knowledge graph, and workflow continuation
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          {[
            { label: 'Active Agents', value: agents.length.toString(), icon: <Bot size={16} />, color: 'text-violet-400' },
            { label: 'Total Executions', value: executions.length.toString(), icon: <Activity size={16} />, color: 'text-cyan-400' },
            { label: 'Graph Nodes', value: graphData?.nodeCount.toString() || '0', icon: <Network size={16} />, color: 'text-emerald-400' },
            { label: 'Graph Edges', value: graphData?.edgeCount.toString() || '0', icon: <GitBranch size={16} />, color: 'text-amber-400' },
          ].map((stat) => (
            <motion.div key={stat.label} variants={staggerItem}>
              <div className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                  <span className={stat.color}>{stat.icon}</span>
                </div>
                <p className="text-xl font-semibold text-zinc-100">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-1">
            <TabsTrigger value="agents" className="rounded-lg text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <Bot size={13} className="mr-1.5" /> Agents
            </TabsTrigger>
            <TabsTrigger value="execute" className="rounded-lg text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <Play size={13} className="mr-1.5" /> Execute
            </TabsTrigger>
            <TabsTrigger value="executions" className="rounded-lg text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <Activity size={13} className="mr-1.5" /> History
            </TabsTrigger>
            <TabsTrigger value="graph" className="rounded-lg text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <Network size={13} className="mr-1.5" /> Knowledge
            </TabsTrigger>
            <TabsTrigger value="workflow" className="rounded-lg text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <RotateCcw size={13} className="mr-1.5" /> Continuation
            </TabsTrigger>
          </TabsList>

          {/* ======== AGENTS TAB ======== */}
          <TabsContent value="agents">
            <motion.div
              key="agents"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agents.map((agent, i) => (
                  <motion.div key={agent.type} variants={staggerItem}>
                    <Card className="glass border-zinc-800/30 hover:border-zinc-700/50 transition-all duration-200 hover:-translate-y-0.5">
                      <CardHeader className="pb-3 p-4">
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${agentColors[agent.type] || 'text-zinc-400 bg-zinc-500/15 border-zinc-500/20'}`}>
                            {agentIcons[agent.type] || <Bot size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm text-zinc-200 leading-tight">{agent.name}</CardTitle>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{agent.model} model</p>
                          </div>
                        </div>
                        <CardDescription className="text-xs text-zinc-500 line-clamp-2">
                          {agent.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 px-4 pb-4 space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities.slice(0, 3).map((cap) => (
                            <Badge key={cap} variant="outline" className="text-[9px] px-1.5 py-0 text-zinc-500 border-zinc-700/50 bg-transparent">
                              {cap}
                            </Badge>
                          ))}
                          {agent.capabilities.length > 3 && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-zinc-600 border-zinc-800/50 bg-transparent">
                              +{agent.capabilities.length - 3}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-600">
                            {agent.stats.total} runs
                          </span>
                          <span className="text-emerald-500">
                            {agent.stats.total > 0 ? Math.round((agent.stats.success / agent.stats.total) * 100) : 0}% success
                          </span>
                        </div>
                        <Progress value={agent.stats.total > 0 ? (agent.stats.success / agent.stats.total) * 100 : 0} className="h-1" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* ======== EXECUTE TAB ======== */}
          <TabsContent value="execute">
            <motion.div
              key="execute"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Task Input */}
                <Card className="glass border-zinc-800/30">
                  <CardHeader className="pb-4 p-5">
                    <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
                      <Sparkles size={16} className="text-violet-400" />
                      Execute Agent Task
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Select an agent and provide input to execute
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium">Agent Type</label>
                      <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800/50 text-sm text-zinc-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800">
                          {agents.map((agent) => (
                            <SelectItem key={agent.type} value={agent.type} className="text-zinc-300 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={agentColors[agent.type]?.split(' ')[0]}>
                                  {agentIcons[agent.type]}
                                </span>
                                {agent.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-medium">Task Input</label>
                      <Textarea
                        value={taskInput}
                        onChange={(e) => setTaskInput(e.target.value)}
                        placeholder="Describe the task for the agent..."
                        className="min-h-[120px] bg-zinc-900/50 border-zinc-800/50 text-sm text-zinc-300 placeholder:text-zinc-600 resize-none"
                      />
                    </div>

                    <Button
                      onClick={handleExecuteAgent}
                      disabled={isExecuting || !taskInput.trim()}
                      className="w-full bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/20 hover:border-violet-500/30"
                    >
                      {isExecuting ? (
                        <>
                          <Loader2 size={14} className="mr-2 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play size={14} className="mr-2" />
                          Execute Task
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Execution Result */}
                <Card className="glass border-zinc-800/30">
                  <CardHeader className="pb-4 p-5">
                    <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
                      <BarChart3 size={16} className="text-cyan-400" />
                      Execution Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    {!executionResult ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
                          <Target size={20} className="text-zinc-600" />
                        </div>
                        <p className="text-sm text-zinc-500 mb-1">No execution yet</p>
                        <p className="text-xs text-zinc-600">Select an agent and execute a task to see results</p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[400px]">
                        <div className="space-y-4">
                          {/* Status */}
                          <div className="flex items-center gap-2">
                            {executionResult.status === 'success' && (
                              <CheckCircle2 size={14} className="text-emerald-400" />
                            )}
                            {executionResult.status === 'failed' && (
                              <XCircle size={14} className="text-red-400" />
                            )}
                            {executionResult.status === 'partial' && (
                              <AlertCircle size={14} className="text-amber-400" />
                            )}
                            <Badge
                              className={`text-[10px] border-0 ${
                                executionResult.status === 'success'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : executionResult.status === 'failed'
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-amber-500/15 text-amber-400'
                              }`}
                            >
                              {String(executionResult.status).toUpperCase()}
                            </Badge>
                            {executionResult.confidence && (
                              <span className="text-[10px] text-zinc-500 ml-auto">
                                Confidence: {Math.round(Number(executionResult.confidence) * 100)}%
                              </span>
                            )}
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-zinc-900/50 rounded-lg p-3">
                              <p className="text-[10px] text-zinc-500 uppercase">Duration</p>
                              <p className="text-sm font-medium text-zinc-300">
                                {formatDuration(Number(executionResult.duration || 0))}
                              </p>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-3">
                              <p className="text-[10px] text-zinc-500 uppercase">Tokens</p>
                              <p className="text-sm font-medium text-zinc-300">
                                {Number(executionResult.tokensUsed || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Output */}
                          <div className="space-y-2">
                            <p className="text-xs text-zinc-400 font-medium">Output</p>
                            <pre className="bg-zinc-900/70 rounded-lg p-4 text-xs text-zinc-400 overflow-auto max-h-[200px] whitespace-pre-wrap font-mono leading-relaxed">
                              {typeof executionResult.output === 'object'
                                ? JSON.stringify(executionResult.output, null, 2)
                                : String(executionResult.output || 'No output')}
                            </pre>
                          </div>

                          {/* Follow-up Actions */}
                          {executionResult.followUpActions && Array.isArray(executionResult.followUpActions) && executionResult.followUpActions.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs text-zinc-400 font-medium">Suggested Actions</p>
                              <div className="space-y-1.5">
                                {executionResult.followUpActions.map((action, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors cursor-pointer group"
                                  >
                                    <ArrowRight size={12} className="text-violet-500 shrink-0" />
                                    <span className="text-xs text-zinc-400 group-hover:text-zinc-300">
                                      {String(action)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          {/* ======== EXECUTIONS TAB ======== */}
          <TabsContent value="executions">
            <motion.div
              key="executions"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Recent Executions
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchExecutions}
                  className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50"
                >
                  <RefreshCw size={12} className="mr-1.5" />
                  Refresh
                </Button>
              </div>

              {executions.length === 0 ? (
                <Card className="glass border-zinc-800/30">
                  <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
                      <Activity size={20} className="text-zinc-600" />
                    </div>
                    <p className="text-sm text-zinc-400 mb-1">No executions yet</p>
                    <p className="text-xs text-zinc-600">Execute an agent task to see execution history</p>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-2">
                    {executions.map((exec, i) => (
                      <motion.div
                        key={exec.taskId}
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                        transition={{ delay: i * 0.03 }}
                        className="glass rounded-xl p-4 hover:bg-zinc-800/20 transition-all duration-200 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${agentColors[exec.agentType] || 'text-zinc-400 bg-zinc-500/15 border-zinc-500/20'}`}>
                            {agentIcons[exec.agentType] || <Bot size={16} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-zinc-300">{exec.agentType}</span>
                              <Badge
                                className={`text-[9px] border-0 px-1.5 py-0 ${
                                  exec.status === 'success'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : exec.status === 'failed'
                                    ? 'bg-red-500/15 text-red-400'
                                    : exec.status === 'running'
                                    ? 'bg-blue-500/15 text-blue-400'
                                    : 'bg-zinc-700/50 text-zinc-400'
                                }`}
                              >
                                {exec.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                              <span>{formatDuration(exec.duration)}</span>
                              <span>{exec.tokensUsed} tokens</span>
                              <span>{exec.confidence > 0 ? `${Math.round(exec.confidence * 100)}%` : '—'}</span>
                            </div>
                          </div>
                          <ArrowRight size={14} className="text-zinc-700 group-hover:text-zinc-400 shrink-0 transition-colors" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </motion.div>
          </TabsContent>

          {/* ======== KNOWLEDGE GRAPH TAB ======== */}
          <TabsContent value="graph">
            <motion.div
              key="graph"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              className="space-y-6"
            >
              {/* Search and Controls */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    value={graphQuery}
                    onChange={(e) => setGraphQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchGraph()}
                    placeholder="Search nodes and edges..."
                    className="h-9 pl-9 rounded-lg bg-zinc-900/50 border-zinc-800/50 text-sm text-zinc-300 placeholder:text-zinc-600"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSearchGraph}
                  className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50"
                >
                  <Search size={12} className="mr-1.5" />
                  Search
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRebuildGraph}
                  disabled={isRebuildingGraph}
                  className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50"
                >
                  {isRebuildingGraph ? (
                    <Loader2 size={12} className="mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw size={12} className="mr-1.5" />
                  )}
                  Rebuild
                </Button>
              </div>

              {/* Graph Summary */}
              {graphData && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Nodes', value: graphData.nodeCount.toString(), icon: <Database size={14} />, color: 'text-violet-400' },
                      { label: 'Total Edges', value: graphData.edgeCount.toString(), icon: <GitBranch size={14} />, color: 'text-cyan-400' },
                      { label: 'Avg Connections', value: graphData.nodeCount > 0 ? (graphData.edgeCount / graphData.nodeCount).toFixed(1) : '0', icon: <Network size={14} />, color: 'text-emerald-400' },
                      { label: 'Density', value: graphData.nodeCount > 1 ? ((2 * graphData.edgeCount) / (graphData.nodeCount * (graphData.nodeCount - 1))).toFixed(3) : '0', icon: <Layers size={14} />, color: 'text-amber-400' },
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

                  {/* Graph Visualization */}
                  <Card className="glass border-zinc-800/30">
                    <CardHeader className="pb-3 p-4">
                      <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                        <Network size={14} className="text-violet-400" />
                        Knowledge Graph Visualization
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="bg-zinc-950/50 rounded-xl border border-zinc-800/30 overflow-hidden" style={{ height: 400 }}>
                        <GraphCanvas
                          nodes={graphData.nodes.slice(0, 80)}
                          edges={graphData.edges.slice(0, 150)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Node List */}
                  <Card className="glass border-zinc-800/30">
                    <CardHeader className="pb-3 p-4">
                      <CardTitle className="text-sm text-zinc-300">Top Nodes</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <ScrollArea className="max-h-[300px]">
                        <div className="space-y-1.5">
                          {graphData.nodes.slice(0, 30).map((node) => (
                            <div key={node.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-800/20 transition-colors group">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center border text-[10px] ${getNodeColor(node.type)}`}>
                                {node.type.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-zinc-300 truncate group-hover:text-zinc-200">{node.label}</p>
                              </div>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-zinc-600 border-zinc-800/50 bg-transparent shrink-0">
                                {node.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>
          </TabsContent>

          {/* ======== WORKFLOW CONTINUATION TAB ======== */}
          <TabsContent value="workflow">
            <motion.div
              key="workflow"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Interrupted Workflows
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { fetchWorkflowSuggestions(); setContinuationResult(null) }}
                  className="border-zinc-700/50 text-zinc-400 text-xs hover:bg-zinc-800/50"
                >
                  <RefreshCw size={12} className="mr-1.5" />
                  Scan
                </Button>
              </div>

              {workflowSuggestions.length === 0 ? (
                <Card className="glass border-zinc-800/30">
                  <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-3">
                      <RotateCcw size={20} className="text-zinc-600" />
                    </div>
                    <p className="text-sm text-zinc-400 mb-1">No interrupted workflows</p>
                    <p className="text-xs text-zinc-600">All active sessions are in progress or no interruptions detected</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workflowSuggestions.map((suggestion, i) => (
                      <motion.div
                        key={suggestion.sessionId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className="glass border-zinc-800/30 hover:border-zinc-700/50 transition-all duration-200">
                          <CardHeader className="pb-3 p-4">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className={`text-[10px] ${agentColors[suggestion.type] || 'text-zinc-500 border-zinc-700/50 bg-transparent'}`}>
                                {suggestion.type}
                              </Badge>
                              <span className="text-[10px] text-zinc-500">
                                {formatTimeSince(suggestion.timeSinceInterruption)}
                              </span>
                            </div>
                            <CardTitle className="text-sm text-zinc-200">{suggestion.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-4 space-y-3">
                            <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                              <span className="flex items-center gap-1">
                                <Layers size={10} />
                                {suggestion.tabsCount} tabs
                              </span>
                              <span className="flex items-center gap-1">
                                <Brain size={10} />
                                {suggestion.memoriesCount} memories
                              </span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleResumeWorkflow(suggestion.sessionId)}
                              className="w-full bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/20 text-xs"
                            >
                              <RotateCcw size={12} className="mr-1.5" />
                              Resume Workflow
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>

                  {/* Continuation Result */}
                  {continuationResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="glass border-violet-500/20 bg-violet-500/[0.02]">
                        <CardHeader className="pb-4 p-5">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
                              <Lightbulb size={16} className="text-amber-400" />
                              Continuation Plan
                            </CardTitle>
                            <Badge className="bg-violet-500/15 text-violet-300 border-0 text-[10px]">
                              {continuationResult.workflowType}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs text-zinc-500 mt-1">
                            {continuationResult.title} — Elapsed: {continuationResult.timeElapsed}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="px-5 pb-5 space-y-4">
                          {/* Completeness Score */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-zinc-400">Context Completeness</span>
                              <span className="text-zinc-300 font-medium">{continuationResult.completenessScore}/100</span>
                            </div>
                            <Progress value={continuationResult.completenessScore} className="h-1.5" />
                          </div>

                          {/* Context Capsule */}
                          <div className="space-y-1.5">
                            <p className="text-xs text-zinc-400 font-medium">Context Summary</p>
                            <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-900/50 rounded-lg p-3">
                              {continuationResult.contextCapsule}
                            </p>
                          </div>

                          {/* Suggested Next Steps */}
                          <div className="space-y-1.5">
                            <p className="text-xs text-zinc-400 font-medium">Suggested Next Steps</p>
                            <div className="space-y-1">
                              {continuationResult.suggestedNextSteps.map((step, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors">
                                  <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-[9px] font-medium text-violet-400">{idx + 1}</span>
                                  </div>
                                  <span className="text-xs text-zinc-400">{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Tabs to Restore */}
                          {continuationResult.tabsToRestore.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs text-zinc-400 font-medium">Tabs to Restore</p>
                              <ScrollArea className="max-h-[150px]">
                                <div className="space-y-1">
                                  {continuationResult.tabsToRestore.map((tab, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-900/30 transition-colors">
                                      <ExternalLink size={10} className="text-zinc-600 shrink-0" />
                                      <span className="text-[11px] text-zinc-500 truncate">{tab.title || tab.url}</span>
                                      {tab.domain && (
                                        <Badge variant="outline" className="text-[8px] px-1 py-0 text-zinc-600 border-zinc-800/50 bg-transparent ml-auto shrink-0">
                                          {tab.domain}
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ============================================================
// Graph Canvas Component (Simple SVG visualization)
// ============================================================

function GraphCanvas({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Simple force-directed-like layout
  const layoutNodes = nodes.map((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2
    const radius = 80 + (i % 5) * 40
    return {
      ...node,
      x: 200 + Math.cos(angle) * radius * (0.5 + (i % 3) * 0.3),
      y: 200 + Math.sin(angle) * radius * (0.5 + (i % 4) * 0.2),
    }
  })

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]))
  const hoveredEdges = hoveredNode
    ? edges.filter((e) => e.fromId === hoveredNode || e.toId === hoveredNode)
    : []

  const nodeTypeColors: Record<string, string> = {
    memory: '#8b5cf6',
    code: '#10b981',
    research: '#06b6d4',
    decision: '#f59e0b',
    reference: '#ec4899',
    general: '#71717a',
    technology: '#06b6d4',
    concept: '#8b5cf6',
    domain: '#f59e0b',
    file: '#10b981',
    named_entity: '#ec4899',
    project: '#ef4444',
  }

  return (
    <svg width="100%" height="100%" viewBox="0 0 400 400" className="overflow-visible">
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(139, 92, 246, 0.15)" />
          <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
        </radialGradient>
      </defs>

      {/* Edges */}
      {edges.map((edge, i) => {
        const from = nodeMap.get(edge.fromId)
        const to = nodeMap.get(edge.toId)
        if (!from || !to) return null

        const isHighlighted = hoveredNode === edge.fromId || hoveredNode === edge.toId
        const opacity = hoveredNode ? (isHighlighted ? 0.6 : 0.05) : 0.15

        return (
          <line
            key={`e-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={isHighlighted ? '#8b5cf6' : '#52525b'}
            strokeWidth={isHighlighted ? 1.5 : 0.5}
            opacity={opacity}
          />
        )
      })}

      {/* Nodes */}
      {layoutNodes.map((node) => {
        const isHovered = hoveredNode === node.id
        const isConnected = hoveredEdges.some(
          (e) => e.fromId === node.id || e.toId === node.id
        )
        const color = nodeTypeColors[node.type] || '#71717a'
        const r = isHovered ? 6 : isConnected ? 5 : 3.5
        const opacity = hoveredNode
          ? isHovered || isConnected
            ? 1
            : 0.2
          : 0.8

        return (
          <g key={node.id}>
            {isHovered && (
              <circle cx={node.x} cy={node.y} r="18" fill="url(#nodeGlow)" />
            )}
            <circle
              cx={node.x}
              cy={node.y}
              r={r}
              fill={color}
              opacity={opacity}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            />
            {isHovered && (
              <text
                x={node.x}
                y={node.y - 10}
                textAnchor="middle"
                className="fill-zinc-300 text-[8px] pointer-events-none"
              >
                {node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ============================================================
// Helpers
// ============================================================

function getNodeColor(type: string): string {
  const colors: Record<string, string> = {
    memory: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
    code: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
    research: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20',
    decision: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
    reference: 'text-pink-400 bg-pink-500/15 border-pink-500/20',
    general: 'text-zinc-400 bg-zinc-500/15 border-zinc-500/20',
    technology: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20',
    concept: 'text-violet-400 bg-violet-500/15 border-violet-500/20',
    domain: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
    project: 'text-red-400 bg-red-500/15 border-red-500/20',
  }
  return colors[type] || 'text-zinc-400 bg-zinc-500/15 border-zinc-500/20'
}
