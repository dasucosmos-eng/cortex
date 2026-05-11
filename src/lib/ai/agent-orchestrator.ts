// ============================================================
// Cognitive Operating System — Agent Orchestrator
// ============================================================
// Core engine for managing, routing, and executing AI agents.
// Supports multi-agent chaining, priority queues, and automatic
// context building from memories and knowledge graphs.
// ============================================================

import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { routeToModel } from "./agent-routers";

// --------------- Type Definitions ---------------

export type AgentType =
  | "research"
  | "coding"
  | "summarization"
  | "timeline"
  | "curator"
  | "optimizer"
  | "connector"
  | "debugging";

interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  model: "fast" | "reasoning" | "creative";
}

export interface AgentTask {
  id: string;
  agentType: AgentType;
  input: Record<string, unknown>;
  context: {
    userId?: string;
    sessionId?: string;
    memoryId?: string;
    projectId?: string;
    relevantMemories: Array<Record<string, unknown>>;
    knowledgeGraph: Record<string, unknown>;
  };
  priority: "low" | "medium" | "high" | "critical";
  createdAt: Date;
}

export interface AgentResult {
  taskId: string;
  agentType: AgentType;
  status: "success" | "partial" | "failed";
  output: Record<string, unknown>;
  confidence: number;
  tokensUsed: number;
  duration: number;
  followUpActions?: string[];
}

interface ChainStep {
  agentType: AgentType;
  inputMapper?: (prevOutput: AgentResult) => Record<string, unknown>;
  condition?: (prevOutput: AgentResult) => boolean;
}

interface ExecutionRecord {
  taskId: string;
  agentType: AgentType;
  status: "pending" | "running" | "success" | "partial" | "failed" | "cancelled";
  result?: AgentResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// --------------- Agent Configurations ---------------

const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  research: {
    type: "research",
    name: "Research Agent",
    description: "Deep research and information gathering agent. Explores topics, finds connections, and synthesizes findings from multiple sources.",
    systemPrompt: `You are a specialized Research Agent within a Cognitive Operating System. Your role is to:

1. Analyze research queries and break them into sub-topics
2. Identify key concepts, technologies, and relationships
3. Synthesize findings into structured, actionable insights
4. Identify knowledge gaps and suggest follow-up research directions
5. Cross-reference with existing knowledge from the user's memory store

Always provide structured output with:
- Key findings (numbered list)
- Related concepts and entities
- Confidence level for each finding (high/medium/low)
- Suggested next research steps
- Connections to existing knowledge

Respond in valid JSON format when possible.`,
    capabilities: ["topic-analysis", "entity-extraction", "cross-referencing", "gap-detection", "synthesis"],
    model: "reasoning",
  },
  coding: {
    type: "coding",
    name: "Coding Agent",
    description: "Code generation, analysis, and debugging assistant. Understands codebases and provides implementation guidance.",
    systemPrompt: `You are a specialized Coding Agent within a Cognitive Operating System. Your role is to:

1. Analyze code requirements and generate high-quality implementations
2. Review existing code for bugs, performance issues, and best practices
3. Suggest refactoring and optimization strategies
4. Explain complex code patterns and architecture decisions
5. Generate tests and documentation

Always provide:
- Clean, well-commented code
- Explanation of the approach
- Potential edge cases
- Performance considerations
- Dependencies or prerequisites

Prefer modern patterns and the user's existing tech stack. Respond in valid JSON when possible.`,
    capabilities: ["code-generation", "code-review", "debugging", "refactoring", "testing", "documentation"],
    model: "reasoning",
  },
  summarization: {
    type: "summarization",
    name: "Summarization Agent",
    description: "Creates concise summaries of sessions, documents, and complex information while preserving key insights.",
    systemPrompt: `You are a specialized Summarization Agent within a Cognitive Operating System. Your role is to:

1. Condense long-form content into clear, actionable summaries
2. Extract key decisions, findings, and action items
3. Identify the most important information at different abstraction levels
4. Generate topic tags and categories
5. Create hierarchical summaries (executive, detailed, technical)

Always structure summaries with:
- One-sentence overview
- Key points (bullet list)
- Decisions made
- Action items
- Related topics/tags

Adapt the detail level to the audience. Respond in valid JSON when possible.`,
    capabilities: ["text-summarization", "topic-extraction", "key-point-identification", "hierarchical-summarization", "tag-generation"],
    model: "fast",
  },
  timeline: {
    type: "timeline",
    name: "Timeline Agent",
    description: "Analyzes activity patterns, builds timelines, and detects workflow interruptions for session continuity.",
    systemPrompt: `You are a specialized Timeline Agent within a Cognitive Operating System. Your role is to:

1. Analyze sequences of events to understand workflow patterns
2. Detect interruptions and context switches
3. Identify productivity patterns and peak focus periods
4. Generate timeline summaries and activity reports
5. Suggest optimal task ordering and time allocation

Provide structured output with:
- Timeline visualization data (structured events)
- Pattern analysis (focus periods, interruptions)
- Productivity metrics
- Workflow optimization suggestions

Respond in valid JSON when possible.`,
    capabilities: ["pattern-detection", "interruption-detection", "productivity-analysis", "timeline-generation", "workflow-optimization"],
    model: "reasoning",
  },
  curator: {
    type: "curator",
    name: "Memory Curator Agent",
    description: "Manages memory lifecycle: deduplication, compression, importance scoring, and hierarchical organization.",
    systemPrompt: `You are a specialized Memory Curator Agent within a Cognitive Operating System. Your role is to:

1. Detect and merge duplicate or near-duplicate memories
2. Compress repetitive memories into consolidated summaries
3. Score memory importance based on recency, connections, and relevance
4. Organize memories into hierarchical structures
5. Identify memories suitable for archival

For each operation provide:
- List of affected memories
- Reasoning for each decision
- Preserved key information
- Updated memory content/structure

Be conservative with deletions — always preserve unique information. Respond in valid JSON when possible.`,
    capabilities: ["deduplication", "compression", "importance-scoring", "hierarchy-building", "archival", "merge-detection"],
    model: "fast",
  },
  optimizer: {
    type: "optimizer",
    name: "Context Optimizer Agent",
    description: "Optimizes AI context windows by selecting the most relevant information and minimizing token usage.",
    systemPrompt: `You are a specialized Context Optimizer Agent within a Cognitive Operating System. Your role is to:

1. Select the most relevant memories and context for a given task
2. Compress context to fit within token limits while preserving meaning
3. Rank context items by relevance score
4. Identify redundant context that can be safely removed
5. Generate compact context capsules for AI processing

Provide structured output with:
- Selected context items (ranked by relevance)
- Removed items with justification
- Token usage estimate
- Compression ratio
- Any information loss warnings

Respond in valid JSON when possible.`,
    capabilities: ["context-selection", "token-optimization", "relevance-ranking", "compression", "context-capsule-generation"],
    model: "fast",
  },
  connector: {
    type: "connector",
    name: "Knowledge Connector Agent",
    description: "Discovers and creates connections between memories, concepts, and knowledge graph nodes.",
    systemPrompt: `You are a specialized Knowledge Connector Agent within a Cognitive Operating System. Your role is to:

1. Find hidden relationships between seemingly unrelated memories
2. Build knowledge graph edges between connected concepts
3. Detect emerging patterns and clusters
4. Suggest potential connections the user may not have considered
5. Maintain graph health by pruning weak connections

Provide structured output with:
- New connections discovered (source → target → type → strength)
- Connection reasoning
- Pattern observations
- Suggested graph reorganizations

Respond in valid JSON when possible.`,
    capabilities: ["relationship-discovery", "graph-building", "pattern-detection", "connection-suggestion", "graph-maintenance"],
    model: "creative",
  },
  debugging: {
    type: "debugging",
    name: "Debugging Agent",
    description: "Analyzes errors, traces issues, and provides systematic debugging strategies with root cause analysis.",
    systemPrompt: `You are a specialized Debugging Agent within a Cognitive Operating System. Your role is to:

1. Analyze error messages and stack traces
2. Identify root causes through systematic elimination
3. Trace code execution paths to locate issues
4. Suggest debugging strategies and tools
5. Verify fixes and prevent regression

Provide structured output with:
- Error classification and severity
- Root cause analysis (most likely → least likely)
- Step-by-step reproduction guide
- Suggested fixes (with code if applicable)
- Prevention strategies

Be methodical and thorough. Always consider edge cases. Respond in valid JSON when possible.`,
    capabilities: ["error-analysis", "root-cause-detection", "trace-analysis", "fix-generation", "regression-prevention"],
    model: "reasoning",
  },
};

// --------------- Priority Weights ---------------

const PRIORITY_WEIGHTS: Record<AgentTask["priority"], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// --------------- In-Memory Execution Store ---------------

const executionStore = new Map<string, ExecutionRecord>();

// --------------- Agent Orchestrator Class ---------------

export class AgentOrchestrator {
  private taskQueue: AgentTask[] = [];
  private isProcessing = false;

  /**
   * Get all available agent configurations.
   */
  getConfigs(): Record<AgentType, AgentConfig> {
    return { ...AGENT_CONFIGS };
  }

  /**
   * Get a specific agent configuration.
   */
  getConfig(type: AgentType): AgentConfig | undefined {
    return AGENT_CONFIGS[type];
  }

  /**
   * Route a task to the appropriate agent based on type.
   */
  route(task: AgentTask): AgentConfig {
    const config = AGENT_CONFIGS[task.agentType];
    if (!config) {
      throw new Error(`Unknown agent type: ${task.agentType}`);
    }
    return config;
  }

  /**
   * Build context for an agent task by gathering relevant memories
   * and knowledge graph data from the database.
   */
  async buildContext(task: AgentTask): Promise<AgentTask["context"]> {
    const enriched = { ...task.context };

    // Gather relevant memories based on session, project, or memory ID
    if (task.context.sessionId) {
      const sessionMemories = await db.memory.findMany({
        where: { sessionId: task.context.sessionId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      enriched.relevantMemories = [
        ...enriched.relevantMemories,
        ...sessionMemories.map((m) => ({
          id: m.id,
          type: m.type,
          content: m.content,
          summary: m.summary,
          tags: m.tags,
          createdAt: m.createdAt,
        })),
      ];
    }

    if (task.context.memoryId) {
      const memory = await db.memory.findUnique({
        where: { id: task.context.memoryId },
        include: {
          relatedFrom: { include: { to: true } },
          relatedTo: { include: { from: true } },
        },
      });
      if (memory) {
        // Add the target memory if not already included
        const alreadyIncluded = enriched.relevantMemories.some(
          (m) => m.id === memory.id
        );
        if (!alreadyIncluded) {
          enriched.relevantMemories.unshift({
            id: memory.id,
            type: memory.type,
            content: memory.content,
            summary: memory.summary,
            tags: memory.tags,
            createdAt: memory.createdAt,
          });
        }
        // Add related memories
        const relatedIds = new Set<string>();
        for (const rel of memory.relatedFrom) {
          relatedIds.add(rel.toId);
        }
        for (const rel of memory.relatedTo) {
          relatedIds.add(rel.fromId);
        }
        if (relatedIds.size > 0) {
          const relatedMemories = await db.memory.findMany({
            where: { id: { in: Array.from(relatedIds) } },
            take: 10,
          });
          for (const rm of relatedMemories) {
            const alreadyIncluded = enriched.relevantMemories.some(
              (m) => m.id === rm.id
            );
            if (!alreadyIncluded) {
              enriched.relevantMemories.push({
                id: rm.id,
                type: rm.type,
                content: rm.content,
                summary: rm.summary,
                tags: rm.tags,
                createdAt: rm.createdAt,
              });
            }
          }
        }
      }
    }

    if (task.context.projectId) {
      const projectMemories = await db.memory.findMany({
        where: { projectId: task.context.projectId },
        orderBy: { createdAt: "desc" },
        take: 15,
      });
      for (const pm of projectMemories) {
        const alreadyIncluded = enriched.relevantMemories.some(
          (m) => m.id === pm.id
        );
        if (!alreadyIncluded) {
          enriched.relevantMemories.push({
            id: pm.id,
            type: pm.type,
            content: pm.content,
            summary: pm.summary,
            tags: pm.tags,
            createdAt: pm.createdAt,
          });
        }
      }
    }

    return enriched;
  }

  /**
   * Execute a single agent task with full context.
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const config = this.route(task);

    // Build enriched context
    const enrichedContext = await this.buildContext(task);

    // Update execution record
    const record = executionStore.get(task.id);
    if (record) {
      record.status = "running";
      record.startedAt = new Date();
    }

    try {
      // Get model configuration from router
      const modelConfig = routeToModel(config.model === "fast" ? "conversation" : config.model === "reasoning" ? "reasoning" : "creative", "normal");

      // Format context for the AI
      const contextSection = enrichedContext.relevantMemories.length > 0
        ? `\n\n--- Relevant Context ---\n${enrichedContext.relevantMemories
            .slice(0, 10)
            .map(
              (m, i) =>
                `[${i + 1}] [${m.type}] ${m.summary || String(m.content).substring(0, 200)}`
            )
            .join("\n")}\n--- End Context ---`
        : "";

      const userMessage = typeof task.input.query === "string"
        ? `${task.input.query}${contextSection}`
        : `${JSON.stringify(task.input, null, 2)}${contextSection}`;

      // Create AI client and execute
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        model: modelConfig.primary,
        messages: [
          { role: "assistant", content: config.systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.maxTokens,
      });

      const aiContent = completion.choices?.[0]?.message?.content || "";
      const tokensUsed = completion.usage?.total_tokens || 0;
      const duration = Date.now() - startTime;

      // Parse structured output
      let parsedOutput: Record<string, unknown> = { response: aiContent };
      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
        const parsed = JSON.parse(jsonStr.trim());
        if (typeof parsed === "object" && parsed !== null) {
          parsedOutput = parsed;
        }
      } catch {
        // Keep raw text response
      }

      const result: AgentResult = {
        taskId: task.id,
        agentType: task.agentType,
        status: "success",
        output: parsedOutput,
        confidence: aiContent.length > 50 ? 0.8 : 0.5,
        tokensUsed,
        duration,
        followUpActions: this.extractFollowUpActions(parsedOutput, task.agentType),
      };

      // Update execution record
      if (record) {
        record.status = "success";
        record.result = result;
        record.completedAt = new Date();
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      const result: AgentResult = {
        taskId: task.id,
        agentType: task.agentType,
        status: "failed",
        output: { error: errorMsg },
        confidence: 0,
        tokensUsed: 0,
        duration,
        followUpActions: ["Retry with modified input", "Check agent configuration", "Try a different agent type"],
      };

      if (record) {
        record.status = "failed";
        record.result = result;
        record.completedAt = new Date();
      }

      return result;
    }
  }

  /**
   * Execute a multi-agent chain workflow.
   */
  async chain(
    initialInput: Record<string, unknown>,
    steps: ChainStep[],
    baseContext?: AgentTask["context"]
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    let currentInput = initialInput;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Check condition if provided
      if (step.condition && results.length > 0) {
        const prevResult = results[results.length - 1];
        if (!step.condition(prevResult)) {
          break;
        }
      }

      // Map input from previous output
      if (step.inputMapper && results.length > 0) {
        currentInput = step.inputMapper(results[results.length - 1]);
      }

      const task: AgentTask = {
        id: `chain-${Date.now()}-${i}`,
        agentType: step.agentType,
        input: currentInput,
        context: baseContext || {
          relevantMemories: [],
          knowledgeGraph: {},
        },
        priority: "medium",
        createdAt: new Date(),
      };

      executionStore.set(task.id, {
        taskId: task.id,
        agentType: task.agentType,
        status: "pending",
        createdAt: new Date(),
      });

      const result = await this.execute(task);
      results.push(result);

      // Stop chain if a step fails
      if (result.status === "failed") {
        break;
      }
    }

    return results;
  }

  /**
   * Enqueue a task for priority-based execution.
   */
  enqueue(task: AgentTask): string {
    this.taskQueue.push(task);
    this.taskQueue.sort(
      (a, b) => PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
    );
    executionStore.set(task.id, {
      taskId: task.id,
      agentType: task.agentType,
      status: "pending",
      createdAt: new Date(),
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return task.id;
  }

  /**
   * Process the task queue.
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true;
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;

      const record = executionStore.get(task.id);
      if (record?.status === "cancelled") continue;

      await this.execute(task);
    }
    this.isProcessing = false;
  }

  /**
   * Get execution statistics for all agents.
   */
  getStats(): Record<
    AgentType,
    { total: number; success: number; failed: number; avgDuration: number }
  > {
    const stats: Record<
      AgentType,
      { total: number; success: number; failed: number; totalDuration: number }
    > = {
      research: { total: 0, success: 0, failed: 0, totalDuration: 0 },
      coding: { total: 0, success: 0, failed: 0, totalDuration: 0 },
      summarization: { total: 0, success: 0, failed: 0, totalDuration: 0 },
      timeline: { total: 0, success: 0, failed: 0, totalDuration: 0 },
      curator: { total: 0, success: 0, failed: 0, totalDuration: 0 },
      optimizer: { total: 0, success: 0, failed: 0, totalDuration: 0 },
      connector: { total: 0, success: 0, failed: 0, totalDuration: 0 },
      debugging: { total: 0, success: 0, failed: 0, totalDuration: 0 },
    };

    for (const record of executionStore.values()) {
      const s = stats[record.agentType];
      s.total++;
      if (record.status === "success") s.success++;
      if (record.status === "failed") s.failed++;
      if (record.result) s.totalDuration += record.result.duration;
    }

    // Convert to final format with averages
    const result: Record<
      AgentType,
      { total: number; success: number; failed: number; avgDuration: number }
    > = {} as Record<AgentType, { total: number; success: number; failed: number; avgDuration: number }>;

    for (const [type, s] of Object.entries(stats)) {
      result[type as AgentType] = {
        total: s.total,
        success: s.success,
        failed: s.failed,
        avgDuration: s.total > 0 ? Math.round(s.totalDuration / s.total) : 0,
      };
    }

    return result;
  }

  /**
   * Get recent execution records.
   */
  getRecentExecutions(limit = 20): ExecutionRecord[] {
    return Array.from(executionStore.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get a specific execution record.
   */
  getExecution(taskId: string): ExecutionRecord | undefined {
    return executionStore.get(taskId);
  }

  /**
   * Cancel a pending or running execution.
   */
  cancelExecution(taskId: string): boolean {
    const record = executionStore.get(taskId);
    if (!record) return false;
    if (record.status === "pending" || record.status === "running") {
      record.status = "cancelled";
      // Remove from queue if pending
      this.taskQueue = this.taskQueue.filter((t) => t.id !== taskId);
      return true;
    }
    return false;
  }

  /**
   * Get the current queue status.
   */
  getQueueStatus(): {
    length: number;
    isProcessing: boolean;
    pendingTasks: Array<{ id: string; agentType: AgentType; priority: AgentTask["priority"] }>;
  } {
    return {
      length: this.taskQueue.length,
      isProcessing: this.isProcessing,
      pendingTasks: this.taskQueue.map((t) => ({
        id: t.id,
        agentType: t.agentType,
        priority: t.priority,
      })),
    };
  }

  /**
   * Extract follow-up action suggestions from agent output.
   */
  private extractFollowUpActions(
    output: Record<string, unknown>,
    agentType: AgentType
  ): string[] {
    const actions: string[] = [];

    if (Array.isArray(output.followUpSteps)) {
      actions.push(...output.followUpSteps.map(String));
    }
    if (Array.isArray(output.nextSteps)) {
      actions.push(...output.nextSteps.map(String));
    }
    if (Array.isArray(output.suggestions)) {
      actions.push(...output.suggestions.map(String));
    }

    // Add type-specific defaults if no actions found
    if (actions.length === 0) {
      const defaults: Record<AgentType, string[]> = {
        research: ["Deep dive into identified topics", "Cross-reference with existing knowledge"],
        coding: ["Review generated code", "Write tests for implementation"],
        summarization: ["Archive summary", "Generate related summaries"],
        timeline: ["Review activity patterns", "Optimize workflow schedule"],
        curator: ["Review merged memories", "Check for remaining duplicates"],
        optimizer: ["Apply optimized context", "Monitor token usage"],
        connector: ["Validate new connections", "Explore detected clusters"],
        debugging: ["Apply suggested fix", "Run tests to verify"],
      };
      actions.push(...(defaults[agentType] || []));
    }

    return actions.slice(0, 5);
  }
}

// --------------- Singleton Export ---------------

let orchestratorInstance: AgentOrchestrator | null = null;

export function getOrchestrator(): AgentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator();
  }
  return orchestratorInstance;
}
