// ============================================================
// Cognitive Operating System — Agent Routers
// ============================================================
// Contextual AI routing system that maps agent tasks to
// appropriate AI models based on context type and privacy level.
// ============================================================

// --------------- Type Definitions ---------------

export type AIContext =
  | "coding"
  | "summarization"
  | "reasoning"
  | "embedding"
  | "creative"
  | "analysis"
  | "conversation";

export type PrivacyLevel = "normal" | "elevated" | "maximum";

export interface ModelConfig {
  context: AIContext;
  models: {
    primary: string;
    fallback: string;
    local: string | null;
  };
  temperature: number;
  maxTokens: number;
}

// --------------- Model Routing Configuration ---------------

const MODEL_ROUTING_TABLE: Record<AIContext, ModelConfig> = {
  coding: {
    context: "coding",
    models: {
      primary: "gpt-4o",
      fallback: "gpt-4o-mini",
      local: "deepseek-coder-v2",
    },
    temperature: 0.2,
    maxTokens: 4096,
  },
  summarization: {
    context: "summarization",
    models: {
      primary: "gpt-4o-mini",
      fallback: "gpt-3.5-turbo",
      local: "phi-3-mini",
    },
    temperature: 0.3,
    maxTokens: 2048,
  },
  reasoning: {
    context: "reasoning",
    models: {
      primary: "gpt-4o",
      fallback: "gpt-4o-mini",
      local: "deepseek-r1",
    },
    temperature: 0.1,
    maxTokens: 4096,
  },
  embedding: {
    context: "embedding",
    models: {
      primary: "text-embedding-3-small",
      fallback: "text-embedding-ada-002",
      local: "all-MiniLM-L6-v2",
    },
    temperature: 0,
    maxTokens: 512,
  },
  creative: {
    context: "creative",
    models: {
      primary: "gpt-4o",
      fallback: "gpt-4o-mini",
      local: "llama-3-70b",
    },
    temperature: 0.8,
    maxTokens: 3072,
  },
  analysis: {
    context: "analysis",
    models: {
      primary: "gpt-4o",
      fallback: "gpt-4o-mini",
      local: "mistral-large",
    },
    temperature: 0.2,
    maxTokens: 4096,
  },
  conversation: {
    context: "conversation",
    models: {
      primary: "gpt-4o-mini",
      fallback: "gpt-3.5-turbo",
      local: "phi-3-mini",
    },
    temperature: 0.6,
    maxTokens: 2048,
  },
};

// --------------- Privacy Routing Rules ---------------

const PRIVACY_OVERRIDES: Record<PrivacyLevel, Partial<Record<AIContext, { preferLocal: boolean; temperatureAdjust: number }>>> = {
  normal: {
    coding: { preferLocal: false, temperatureAdjust: 0 },
    summarization: { preferLocal: false, temperatureAdjust: 0 },
    reasoning: { preferLocal: false, temperatureAdjust: 0 },
    embedding: { preferLocal: false, temperatureAdjust: 0 },
    creative: { preferLocal: false, temperatureAdjust: 0 },
    analysis: { preferLocal: false, temperatureAdjust: 0 },
    conversation: { preferLocal: false, temperatureAdjust: 0 },
  },
  elevated: {
    coding: { preferLocal: true, temperatureAdjust: -0.1 },
    summarization: { preferLocal: true, temperatureAdjust: -0.1 },
    reasoning: { preferLocal: true, temperatureAdjust: -0.05 },
    embedding: { preferLocal: true, temperatureAdjust: 0 },
    creative: { preferLocal: false, temperatureAdjust: -0.1 },
    analysis: { preferLocal: true, temperatureAdjust: -0.1 },
    conversation: { preferLocal: true, temperatureAdjust: -0.1 },
  },
  maximum: {
    coding: { preferLocal: true, temperatureAdjust: -0.15 },
    summarization: { preferLocal: true, temperatureAdjust: -0.15 },
    reasoning: { preferLocal: true, temperatureAdjust: -0.1 },
    embedding: { preferLocal: true, temperatureAdjust: 0 },
    creative: { preferLocal: true, temperatureAdjust: -0.15 },
    analysis: { preferLocal: true, temperatureAdjust: -0.15 },
    conversation: { preferLocal: true, temperatureAdjust: -0.15 },
  },
};

// --------------- Agent-to-Context Mapping ---------------

const AGENT_CONTEXT_MAP: Record<string, AIContext> = {
  research: "analysis",
  coding: "coding",
  summarization: "summarization",
  timeline: "analysis",
  curator: "analysis",
  optimizer: "reasoning",
  connector: "creative",
  debugging: "reasoning",
};

// --------------- Routing Functions ---------------

/**
 * Route a request to the appropriate AI model based on context type
 * and privacy level.
 */
export function routeToModel(
  context: AIContext,
  privacyLevel: PrivacyLevel = "normal"
): ModelConfig & { selectedModel: string; reason: string } {
  const baseConfig = MODEL_ROUTING_TABLE[context];
  if (!baseConfig) {
    throw new Error(`Unknown AI context: ${context}`);
  }

  const privacyRules = PRIVACY_OVERRIDES[privacyLevel]?.[context];
  const preferLocal = privacyRules?.preferLocal ?? false;
  const temperatureAdjust = privacyRules?.temperatureAdjust ?? 0;

  // Determine selected model
  let selectedModel: string;
  let reason: string;

  if (preferLocal && baseConfig.models.local) {
    selectedModel = baseConfig.models.local;
    reason = `Privacy level "${privacyLevel}" — routing to local model`;
  } else {
    selectedModel = baseConfig.models.primary;
    reason = `Standard routing to primary cloud model`;
  }

  return {
    ...baseConfig,
    selectedModel,
    temperature: Math.max(0, Math.min(2, baseConfig.temperature + temperatureAdjust)),
    reason,
  };
}

/**
 * Get the AI context type for a given agent type.
 */
export function getContextForAgent(agentType: string): AIContext {
  return AGENT_CONTEXT_MAP[agentType] || "conversation";
}

/**
 * Get all available model configurations.
 */
export function getAllModelConfigs(): Record<AIContext, ModelConfig> {
  return { ...MODEL_ROUTING_TABLE };
}

/**
 * Get model configuration summary for display.
 */
export function getModelSummary(): Array<{
  context: AIContext;
  primaryModel: string;
  fallbackModel: string;
  hasLocal: boolean;
  temperature: number;
  maxTokens: number;
}> {
  return Object.entries(MODEL_ROUTING_TABLE).map(([context, config]) => ({
    context: context as AIContext,
    primaryModel: config.models.primary,
    fallbackModel: config.models.fallback,
    hasLocal: config.models.local !== null,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  }));
}

/**
 * Select the best model for a task based on the task description
 * and content analysis.
 */
export function autoRoute(content: string): {
  context: AIContext;
  config: ModelConfig & { selectedModel: string; reason: string };
} {
  const lowerContent = content.toLowerCase();

  // Heuristic-based content analysis
  const scores: Record<AIContext, number> = {
    coding: 0,
    summarization: 0,
    reasoning: 0,
    embedding: 0,
    creative: 0,
    analysis: 0,
    conversation: 0,
  };

  // Coding indicators
  if (/\b(function|class|interface|import|export|const|let|var|return|async|await)\b/.test(lowerContent)) scores.coding += 3;
  if (/\b(code|debug|error|bug|implement|refactor|compile|runtime)\b/.test(lowerContent)) scores.coding += 2;
  if (/\b(python|javascript|typescript|rust|go|java|react|vue|next\.?js)\b/.test(lowerContent)) scores.coding += 2;

  // Summarization indicators
  if (/\b(summarize|summary|condense|brief|overview|tldr|recap)\b/.test(lowerContent)) scores.summarization += 3;
  if (content.length > 1000) scores.summarization += 1;

  // Reasoning indicators
  if (/\b(analyze|because|therefore|logic|prove|deduce|infer|compare)\b/.test(lowerContent)) scores.reasoning += 3;
  if (/\b(if.*then|step.?by.?step|systematic|approach)\b/.test(lowerContent)) scores.reasoning += 2;

  // Creative indicators
  if (/\b(create|design|imagine|brainstorm|innovate|generate idea|explore)\b/.test(lowerContent)) scores.creative += 3;
  if (/\b(story|poem|creative|art|music|novel|metaphor)\b/.test(lowerContent)) scores.creative += 2;

  // Analysis indicators
  if (/\b(analyze|investigate|examine|evaluate|assess|metric|pattern)\b/.test(lowerContent)) scores.analysis += 3;
  if (/\b(data|statistic|trend|correlation|distribution|outlier)\b/.test(lowerContent)) scores.analysis += 2;

  // Conversation as default
  scores.conversation = 1;

  // Find the highest scoring context
  let bestContext: AIContext = "conversation";
  let bestScore = 0;
  for (const [ctx, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestContext = ctx as AIContext;
    }
  }

  return {
    context: bestContext,
    config: routeToModel(bestContext),
  };
}
