// ============================================================
// Memora Bond — AI Browser Memory Extension
// Background Service Worker (Manifest V3)
// ============================================================

// ===== CONSTANTS =====
const STORAGE_KEYS = {
  MEMORIES: 'memories',
  SESSIONS: 'sessions',
  TIMELINE: 'timeline',
  VAULT: 'vault',
  SETTINGS: 'settings',
  ACTIVITY_BUFFER: 'activityBuffer',
  TAB_STATES: 'tabStates',
  WORKSPACE_CONTEXT: 'workspaceContext',
};

const DEBOUNCE_MS = 3000;
const SESSION_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_MEMORIES = 10000;
const MAX_TIMELINE_ENTRIES = 50000;
const MAX_SESSIONS = 1000;

// Sensitive URL patterns — never track these
const SENSITIVE_DOMAINS = [
  /banking|bank|finance/i,
  /paypal|stripe|checkout|payment/i,
  /medical|health|hospital|pharmacy|doctor/i,
  /password|login|signin|auth/i,
  /social\.security|ssn/i,
  /credit.*card|debit.*card/i,
  /insurance/i,
  /tax|irs|government/i,
  /court|legal|attorney|lawyer/i,
  /password-reset|forgot-password/i,
  /account.*settings|billing/i,
];

// Page type detection patterns
const PAGE_TYPE_PATTERNS = {
  docs: [
    /docs\.google\.com/i,
    /notion\.so/i,
    /confluence/i,
    /overleaf/i,
    /medium\.com/i,
    /substack\.com/i,
    /dev\.to/i,
  ],
  social: [
    /twitter\.com|x\.com/i,
    /facebook\.com/i,
    /instagram\.com/i,
    /linkedin\.com/i,
    /reddit\.com/i,
    /mastodon/i,
    /threads\.net/i,
  ],
  code: [
    /github\.com/i,
    /gitlab\.com/i,
    /bitbucket\.org/i,
    /stackoverflow\.com/i,
    /codepen\.io/i,
    /replit\.com/i,
    /codesandbox\.io/i,
    /vscode\.dev/i,
  ],
  email: [
    /mail\.google\.com/i,
    /outlook\.live\.com/i,
    /protonmail\.com/i,
    /mail\.yahoo\.com/i,
  ],
  video: [
    /youtube\.com/i,
    /vimeo\.com/i,
    /twitch\.tv/i,
    /netflix\.com/i,
    /dailymotion\.com/i,
  ],
  shopping: [
    /amazon\.com/i,
    /ebay\.com/i,
    /shopify\.com/i,
    /etsy\.com/i,
    /walmart\.com/i,
    /aliexpress\.com/i,
  ],
  ai: [
    /chatgpt\.com/i,
    /claude\.ai/i,
    /gemini\.google\.com/i,
    /perplexity\.ai/i,
    /copilot/i,
    /anthropic\.com/i,
    /openai\.com/i,
  ],
};

// Sensitive content regex patterns
const SENSITIVE_CONTENT_PATTERNS = [
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // credit card
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, // SSN
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // email
  /\b\d{1,4}[-\s\/]\d{1,2}[-\s\/]\d{2,4}\b/g, // date
  /password\s*[:=]\s*\S+/gi, // passwords
  /api[_-]?key\s*[:=]\s*\S+/gi, // API keys
  /secret[_-]?key\s*[:=]\s*\S+/gi, // secret keys
  /token\s*[:=]\s*\S+/gi, // tokens
  /bearer\s+\S+/gi, // bearer tokens
  /(sk|pk|rk)-(live|test)-[a-zA-Z0-9]+/g, // Stripe keys
  /ghp_[a-zA-Z0-9]{36}/g, // GitHub PAT
  /glpat-[a-zA-Z0-9\-]{20}/g, // GitLab PAT
  /xox[bpas]-[a-zA-Z0-9\-]+/g, // Slack tokens
];

// ===== IN-MEMORY STATE =====
let activityBuffer = new Map(); // tabId -> { events: [], lastActivity: timestamp }
let activeSession = null;
let debounceTimers = new Map(); // tabId -> timeoutId
let workspaceContexts = new Map(); // domain -> { title, category, tabs: Set }

// Persist critical state to survive service worker restarts (MV3)
let _persistTimer = null;
async function persistCriticalState() {
  try {
    await chrome.storage.local.set({
      _activeSession: activeSession ? JSON.stringify(activeSession) : null,
      _workspaceContexts: JSON.stringify(Array.from(workspaceContexts.entries())),
      _lastPersist: Date.now(),
    });
  } catch (err) {
    console.error('[Memora Bond] Failed to persist state:', err);
  }
}

// Throttled persist — runs at most every 30 seconds
function schedulePersist() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    persistCriticalState();
  }, 30000);
}

// Restore critical state on startup
async function restoreCriticalState() {
  try {
    const data = await chrome.storage.local.get(['_activeSession', '_workspaceContexts']);
    if (data._activeSession) {
      activeSession = JSON.parse(data._activeSession);
    }
    if (data._workspaceContexts) {
      const entries = JSON.parse(data._workspaceContexts);
      workspaceContexts = new Map(entries);
    }
  } catch (err) {
    console.error('[Memora Bond] Failed to restore state:', err);
  }
}

// ===== UTILITY FUNCTIONS =====

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

function isSensitiveUrl(url) {
  if (!url) return true;
  try {
    const hostname = new URL(url).hostname;
    return SENSITIVE_DOMAINS.some(pattern => pattern.test(hostname + url));
  } catch {
    return true;
  }
}

function isIgnoredDomain(domain, settings) {
  if (!domain) return true;
  if (settings?.ignoredDomains?.length > 0) {
    return settings.ignoredDomains.some(d =>
      domain === d || domain.endsWith(`.${d}`)
    );
  }
  return false;
}

function detectPageType(url) {
  if (!url) return 'general';
  for (const [type, patterns] of Object.entries(PAGE_TYPE_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(url))) return type;
  }
  return 'general';
}

function containsSensitiveContent(text) {
  if (!text || typeof text !== 'string') return false;
  const redacted = text.replace(/\s+/g, ' ');
  return SENSITIVE_CONTENT_PATTERNS.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(redacted);
  });
}

function redactSensitiveContent(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  SENSITIVE_CONTENT_PATTERNS.forEach(pattern => {
    result = result.replace(pattern, '[REDACTED]');
  });
  return result;
}

function getTimestamp() {
  return Date.now();
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function debounce(tabId, callback, delay = DEBOUNCE_MS) {
  if (debounceTimers.has(tabId)) {
    clearTimeout(debounceTimers.get(tabId));
  }
  debounceTimers.set(tabId, setTimeout(() => {
    debounceTimers.delete(tabId);
    callback();
  }, delay));
}

// ===== STORAGE HELPERS =====

async function getStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ?? null);
    });
  });
}

async function setStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

async function addToStorage(key, item, maxItems = null) {
  const items = (await getStorage(key)) || [];
  items.push(item);
  if (maxItems && items.length > maxItems) {
    // Keep the most recent items
    items.splice(0, items.length - maxItems);
  }
  await setStorage(key, items);
  return items;
}

// ===== TAB TRACKER =====

function handleTabCreated(tab) {
  if (tab.incognito) return;

  activityBuffer.set(tab.id, {
    events: [{ type: 'created', timestamp: getTimestamp() }],
    lastActivity: getTimestamp(),
    url: tab.url || '',
    title: tab.title || '',
  });

  console.log(`[Memora Bond] Tab created: ${tab.id} - ${tab.title || 'Untitled'}`);
}

function handleTabUpdated(tabId, changeInfo, tab) {
  if (!changeInfo) return;
  if (tab.incognito) return;

  // Process settings check
  checkSettingsAndTrack(async (settings) => {
    const domain = getDomain(tab.url || changeInfo.url || '');
    if (isSensitiveUrl(tab.url || changeInfo.url || '')) return;
    if (isIgnoredDomain(domain, settings)) return;
    if (!settings.isTracking) return;

    const buffer = activityBuffer.get(tabId) || {
      events: [],
      lastActivity: 0,
      url: '',
      title: '',
    };

    buffer.url = tab.url || changeInfo.url || buffer.url;
    buffer.title = tab.title || buffer.title;
    buffer.lastActivity = getTimestamp();

    if (changeInfo.url) {
      buffer.events.push({
        type: 'navigate',
        url: changeInfo.url,
        domain,
        timestamp: getTimestamp(),
      });
    }

    if (changeInfo.title) {
      buffer.events.push({
        type: 'title_change',
        title: changeInfo.title,
        timestamp: getTimestamp(),
      });
    }

    if (changeInfo.status === 'complete') {
      buffer.events.push({
        type: 'load_complete',
        timestamp: getTimestamp(),
      });
    }

    activityBuffer.set(tabId, buffer);

    // Debounce the processing
    debounce(tabId, () => processTabActivity(tabId));
  });
}

function handleTabRemoved(tabId, removeInfo) {
  const buffer = activityBuffer.get(tabId);

  if (buffer && buffer.events.length > 0) {
    // Process any remaining events before tab closes
    processTabActivity(tabId);
  }

  activityBuffer.delete(tabId);

  if (debounceTimers.has(tabId)) {
    clearTimeout(debounceTimers.get(tabId));
    debounceTimers.delete(tabId);
  }

  // Remove from workspace contexts
  if (buffer?.url) {
    const domain = getDomain(buffer.url);
    if (workspaceContexts.has(domain)) {
      const ctx = workspaceContexts.get(domain);
      ctx.tabs.delete(tabId);
      if (ctx.tabs.size === 0) {
        workspaceContexts.delete(domain);
      }
    }
  }

  console.log(`[Memora Bond] Tab removed: ${tabId}`);
}

function handleTabActivated(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!tab || tab.incognito) return;

    checkSettingsAndTrack((settings) => {
      if (!settings.isTracking) return;
      if (isSensitiveUrl(tab.url)) return;

      const buffer = activityBuffer.get(tab.id) || {
        events: [],
        lastActivity: 0,
        url: '',
        title: '',
      };

      buffer.url = tab.url || buffer.url;
      buffer.title = tab.title || buffer.title;
      buffer.lastActivity = getTimestamp();

      buffer.events.push({
        type: 'activated',
        url: tab.url,
        domain: getDomain(tab.url),
        timestamp: getTimestamp(),
      });

      activityBuffer.set(tab.id, buffer);

      // Update workspace context
      const domain = getDomain(tab.url);
      if (domain && !isSensitiveUrl(tab.url)) {
        if (!workspaceContexts.has(domain)) {
          workspaceContexts.set(domain, {
            title: domain,
            category: detectPageType(tab.url),
            tabs: new Set(),
            firstSeen: getTimestamp(),
            lastSeen: getTimestamp(),
          });
        }
        const ctx = workspaceContexts.get(domain);
        ctx.tabs.add(tab.id);
        ctx.lastSeen = getTimestamp();
      }

      // Ensure we have an active session
      ensureActiveSession(tab);

      // Debounce processing
      debounce(tab.id, () => processTabActivity(tab.id));
    });
  });
}

function handleWindowFocusChanged(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs.length > 0 && !tabs[0].incognito) {
      handleTabActivated({ tabId: tabs[0].id, windowId });
    }
  });
}

async function processTabActivity(tabId) {
  const buffer = activityBuffer.get(tabId);
  if (!buffer || buffer.events.length === 0) return;

  chrome.tabs.get(tabId, async (tab) => {
    if (!tab || tab.incognito) return;

    const settings = await getStorage(STORAGE_KEYS.SETTINGS);
    if (!settings?.isTracking) return;

    const url = tab.url || buffer.url;
    const title = tab.title || buffer.title;
    const domain = getDomain(url);

    if (isSensitiveUrl(url)) {
      activityBuffer.delete(tabId);
      return;
    }
    if (isIgnoredDomain(domain, settings)) {
      activityBuffer.delete(tabId);
      return;
    }

    // Extract meaningful events
    const navigations = buffer.events.filter(e => e.type === 'navigate' || e.type === 'load_complete');
    const activations = buffer.events.filter(e => e.type === 'activated');

    // Determine what to capture
    if (navigations.length > 0 || activations.length > 0) {
      const pageType = detectPageType(url);
      const now = getTimestamp();

      // Add timeline entry
      const timelineEntry = {
        id: generateId(),
        type: 'page_view',
        url,
        title: title || 'Untitled',
        domain,
        pageType,
        tabId,
        sessionId: activeSession?.id || null,
        timestamp: now,
        duration: activations.length * 3, // Estimate ~3s per activation
      };

      await addToStorage(STORAGE_KEYS.TIMELINE, timelineEntry, MAX_TIMELINE_ENTRIES);

      // Try to extract content from the tab
      tryExtractContent(tabId, { url, title, domain, pageType, sessionId: activeSession?.id });

      // Update session
      if (activeSession) {
        activeSession.lastActivity = now;
        activeSession.pageViews = (activeSession.pageViews || 0) + 1;
        if (domain && !(activeSession.domains || []).includes(domain)) {
          activeSession.domains = [...(activeSession.domains || []), domain];
        }
        await updateSession(activeSession);
        schedulePersist(); // Persist in-memory state periodically
      }
    }

    // Clear processed events
    buffer.events = [];
    activityBuffer.set(tabId, buffer);
  });
}

// ===== SESSION MANAGER =====

async function ensureActiveSession(tab) {
  const settings = await getStorage(STORAGE_KEYS.SETTINGS);
  if (!settings?.isTracking) return;

  const now = getTimestamp();

  if (activeSession) {
    // Check if session should continue
    const gap = now - activeSession.lastActivity;
    if (gap > SESSION_INACTIVITY_MS) {
      // End current session and start new one
      await endSession(activeSession);
      activeSession = null;
    }
  }

  if (!activeSession) {
    const domain = getDomain(tab?.url || '');
    const pageType = detectPageType(tab?.url || '');

    activeSession = {
      id: generateId(),
      type: 'work',
      title: deriveSessionTitle(tab, domain, pageType),
      domains: domain ? [domain] : [],
      pageViews: 1,
      tabCount: 1,
      startTime: now,
      lastActivity: now,
      endTime: null,
      status: 'active',
      pageTypes: pageType ? [pageType] : [],
    };

    await addToStorage(STORAGE_KEYS.SESSIONS, { ...activeSession }, MAX_SESSIONS);
    console.log(`[Memora Bond] Session started: ${activeSession.title}`);
  }

  // Update tab count
  chrome.tabs.query({}, (tabs) => {
    const nonIncognito = tabs.filter(t => !t.incognito);
    activeSession.tabCount = nonIncognito.length;
    updateSession(activeSession);
  });
}

function deriveSessionTitle(tab, domain, pageType) {
  const hour = new Date().getHours();
  let timeOfDay = 'Morning';
  if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
  else if (hour >= 21 || hour < 5) timeOfDay = 'Night';

  if (pageType === 'code') return `${timeOfDay} Coding Session`;
  if (pageType === 'docs') return `${timeOfDay} Research Session`;
  if (pageType === 'email') return `${timeOfDay} Email Session`;
  if (pageType === 'social') return `${timeOfDay} Social Browsing`;
  if (pageType === 'video') return `${timeOfDay} Video Session`;
  if (pageType === 'ai') return `${timeOfDay} AI Session`;

  if (domain) return `${timeOfDay} — ${domain}`;
  return `${timeOfDay} Session`;
}

async function endSession(session) {
  if (!session) return;

  session.endTime = getTimestamp();
  session.status = 'ended';
  session.duration = session.endTime - session.startTime;

  const sessions = (await getStorage(STORAGE_KEYS.SESSIONS)) || [];
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx !== -1) {
    sessions[idx] = session;
    await setStorage(STORAGE_KEYS.SESSIONS, sessions);
  }

  console.log(`[Memora Bond] Session ended: ${session.title} (${formatDuration(session.duration)})`);
}

async function updateSession(session) {
  if (!session) return;

  const sessions = (await getStorage(STORAGE_KEYS.SESSIONS)) || [];
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx !== -1) {
    sessions[idx] = session;
    await setStorage(STORAGE_KEYS.SESSIONS, sessions);
  }
}

async function endInactiveSessions() {
  const now = getTimestamp();
  const sessions = (await getStorage(STORAGE_KEYS.SESSIONS)) || [];

  for (const session of sessions) {
    if (session.status === 'active' && (now - session.lastActivity) > SESSION_INACTIVITY_MS) {
      session.endTime = session.lastActivity;
      session.status = 'ended';
      session.duration = session.endTime - session.startTime;
    }
  }

  await setStorage(STORAGE_KEYS.SESSIONS, sessions);

  // Also end current in-memory session if inactive
  if (activeSession && (now - activeSession.lastActivity) > SESSION_INACTIVITY_MS) {
    await endSession(activeSession);
    activeSession = null;
  }
}

// ===== CONTENT EXTRACTOR =====

async function tryExtractContent(tabId, metadata, retries = 2) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'EXTRACT_CONTENT',
      metadata,
    });

    if (response && response.content) {
      await processExtractedContent(response.content, metadata);
    }
  } catch (err) {
    if (retries > 0) {
      // Content script may not be loaded yet — retry after a delay
      setTimeout(() => tryExtractContent(tabId, metadata, retries - 1), 2000);
    } else {
      console.log(`[Memora Bond] Could not extract content from tab ${tabId}:`, err.message);
    }
  }
}

async function processExtractedContent(content, metadata) {
  const settings = await getStorage(STORAGE_KEYS.SETTINGS);
  if (!settings?.isTracking) return;

  const { url, title, domain, pageType, sessionId } = metadata;

  // Clean content
  let cleanText = (content.text || '').trim();
  cleanText = cleanText.replace(/\s+/g, ' ').substring(0, 10000);

  const cleanTitle = (content.title || title || '').trim().substring(0, 500);
  const cleanDescription = (content.description || '').trim().substring(0, 1000);

  // Check for sensitive content
  const isSensitive = containsSensitiveContent(cleanText) ||
                       containsSensitiveContent(cleanTitle) ||
                       containsSensitiveContent(cleanDescription);

  // Redact if sensitive
  const processedText = isSensitive ? redactSensitiveContent(cleanText) : cleanText;
  const processedTitle = isSensitive ? redactSensitiveContent(cleanTitle) : cleanTitle;
  const processedDescription = isSensitive ? redactSensitiveContent(cleanDescription) : cleanDescription;

  if (isSensitive) {
    // Route to vault instead of normal memory
    const vaultEntry = {
      id: generateId(),
      type: 'sensitive_page',
      url,
      title: processedTitle,
      domain,
      pageType,
      description: processedDescription,
      timestamp: getTimestamp(),
      sessionId,
      redacted: true,
    };

    await addToStorage(STORAGE_KEYS.VAULT, vaultEntry, 1000);
    console.log(`[Memora Bond] Sensitive content vaulted: ${url}`);
    return;
  }

  // Check if we already have a memory for this URL (avoid duplicates)
  const memories = (await getStorage(STORAGE_KEYS.MEMORIES)) || [];
  const existingIdx = memories.findIndex(m => m.url === url && m.type === 'page');
  if (existingIdx !== -1) {
    // Update existing memory instead of creating new one
    memories[existingIdx].visitCount = (memories[existingIdx].visitCount || 1) + 1;
    memories[existingIdx].lastVisited = getTimestamp();
    memories[existingIdx].title = cleanTitle || memories[existingIdx].title;
    if (processedDescription) {
      memories[existingIdx].description = processedDescription;
    }
    await setStorage(STORAGE_KEYS.MEMORIES, memories);
    return;
  }

  // Create memory entry
  const memory = {
    id: generateId(),
    type: 'page',
    url,
    title: cleanTitle,
    domain,
    pageType,
    description: processedDescription,
    keywords: content.keywords || [],
    textPreview: processedText.substring(0, 5000), // Store up to 5000 chars for better search
    fullText: processedText, // Store full text up to 10000 chars
    textLength: processedText.length,
    visitCount: 1,
    firstVisited: getTimestamp(),
    lastVisited: getTimestamp(),
    sessionId,
    // Embedding placeholder — in production, this would be a vector
    embedding: null,
    tags: inferTags(url, domain, pageType, cleanTitle),
    importance: calculateImportance(pageType, processedText.length, content),
  };

  await addToStorage(STORAGE_KEYS.MEMORIES, memory, MAX_MEMORIES);
  console.log(`[Memora Bond] Memory stored: ${cleanTitle || url}`);
}

function inferTags(url, domain, pageType, title) {
  const tags = [pageType];

  // Add domain-based tags
  if (domain.includes('github')) tags.push('repository', 'code');
  else if (domain.includes('stackoverflow')) tags.push('qa', 'code');
  else if (domain.includes('docs.google')) tags.push('document', 'collaboration');
  else if (domain.includes('notion')) tags.push('notes', 'workspace');
  else if (domain.includes('youtube')) tags.push('video', 'media');
  else if (domain.includes('chatgpt') || domain.includes('claude')) tags.push('ai', 'assistant');
  else if (domain.includes('reddit')) tags.push('forum', 'discussion');
  else if (domain.includes('twitter') || domain.includes('x.com')) tags.push('social', 'microblog');
  else if (domain.includes('linkedin')) tags.push('professional', 'networking');
  else if (domain.includes('medium') || domain.includes('dev.to')) tags.push('article', 'reading');

  // Add title-based tags
  if (title) {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('tutorial')) tags.push('tutorial', 'learning');
    if (titleLower.includes('api') || titleLower.includes('documentation')) tags.push('reference');
    if (titleLower.includes('blog')) tags.push('blog', 'reading');
    if (titleLower.includes('error') || titleLower.includes('fix')) tags.push('debugging');
    if (titleLower.includes('how to') || titleLower.includes('guide')) tags.push('guide');
    if (titleLower.includes('config') || titleLower.includes('setup')) tags.push('configuration');
  }

  // Deduplicate
  return [...new Set(tags)];
}

function calculateImportance(pageType, textLength, content) {
  let score = 0.5; // base score

  // Page type weight
  const typeWeights = {
    docs: 0.8,
    code: 0.9,
    ai: 0.85,
    email: 0.6,
    social: 0.2,
    video: 0.3,
    shopping: 0.15,
    general: 0.4,
  };
  score = typeWeights[pageType] || 0.4;

  // Content depth bonus
  if (textLength > 2000) score += 0.1;
  if (textLength > 5000) score += 0.1;
  if (textLength > 10000) score += 0.1;

  // User interaction bonus
  if (content?.selectedText) score += 0.15;
  if (content?.keywords?.length > 3) score += 0.05;

  return Math.min(1.0, Math.max(0.0, score));
}

// ===== CONTEXT ENGINE =====

function buildWorkspaceSummary() {
  const workspaces = [];

  for (const [domain, ctx] of workspaceContexts.entries()) {
    workspaces.push({
      domain,
      title: ctx.title,
      category: ctx.category,
      tabCount: ctx.tabs.size,
      firstSeen: ctx.firstSeen,
      lastSeen: ctx.lastSeen,
      duration: ctx.lastSeen - ctx.firstSeen,
    });
  }

  // Sort by most active (most tabs, then most recent)
  workspaces.sort((a, b) => {
    if (b.tabCount !== a.tabCount) return b.tabCount - a.tabCount;
    return b.lastSeen - a.lastSeen;
  });

  return workspaces;
}

async function generateSessionSummary(session) {
  if (!session) return null;

  const sessions = (await getStorage(STORAGE_KEYS.SESSIONS)) || [];
  const fullSession = sessions.find(s => s.id === session.id) || session;

  const domainList = fullSession.domains || [];
  const pageTypes = fullSession.pageTypes || [];
  const duration = fullSession.endTime
    ? fullSession.endTime - fullSession.startTime
    : getTimestamp() - fullSession.startTime;

  // Generate a simple text summary
  const domainsStr = domainList.length <= 3
    ? domainList.join(', ')
    : `${domainList.slice(0, 3).join(', ')} and ${domainList.length - 3} more`;

  const typesStr = [...new Set(pageTypes)].join(', ');

  return {
    text: `${fullSession.title}: ${duration > 0 ? formatDuration(duration) : 'ongoing'} across ${domainList.length} site${domainList.length !== 1 ? 's' : ''}`,
    domains: domainList,
    pageTypes: [...new Set(pageTypes)],
    pageViews: fullSession.pageViews || 0,
    duration,
  };
}

// ===== MANUAL MEMORY CREATION =====

async function saveManualMemory(data) {
  const settings = await getStorage(STORAGE_KEYS.SETTINGS);

  let content = data.text || data.content || '';
  let title = data.title || 'Manual Note';
  let url = data.url || '';
  let domain = data.domain || getDomain(url);

  // Check sensitivity
  const isSensitive = containsSensitiveContent(content) || containsSensitiveContent(title);
  const processedContent = isSensitive ? redactSensitiveContent(content) : content;
  const processedTitle = isSensitive ? redactSensitiveContent(title) : title;

  const memory = {
    id: generateId(),
    type: data.type || 'note',
    url: url || null,
    title: processedTitle,
    domain: domain || null,
    pageType: url ? detectPageType(url) : 'note',
    description: processedContent.substring(0, 1000),
    textPreview: processedContent.substring(0, 5000), // Store up to 5000 chars for better search
    fullText: processedContent, // Store full text up to 10000 chars
    textLength: processedContent.length,
    visitCount: 1,
    firstVisited: getTimestamp(),
    lastVisited: getTimestamp(),
    sessionId: activeSession?.id || null,
    tags: data.tags || ['manual', 'note'],
    importance: 0.7,
    source: data.source || 'manual',
    embedding: null,
  };

  if (isSensitive) {
    memory.redacted = true;
    await addToStorage(STORAGE_KEYS.VAULT, memory, 1000);
  } else {
    await addToStorage(STORAGE_KEYS.MEMORIES, memory, MAX_MEMORIES);
  }

  return memory;
}

// ===== HISTORY ANALYZER =====

async function analyzeBrowsingHistory() {
  try {
    const since = Date.now() - (24 * 60 * 60 * 1000); // Last 24 hours
    const items = await chrome.history.search({
      text: '',
      startTime: since,
      maxResults: 500,
    });

    if (!items || items.length === 0) return;

    // Group by domain
    const domainGroups = new Map();
    let totalVisits = 0;

    for (const item of items) {
      if (isSensitiveUrl(item.url)) continue;

      const domain = getDomain(item.url);
      if (!domain) continue;

      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, {
          domain,
          title: item.title || domain,
          visits: 0,
          lastVisit: 0,
          pageTypes: new Set(),
          urls: new Set(),
        });
      }

      const group = domainGroups.get(domain);
      group.visits++;
      group.lastVisit = Math.max(group.lastVisit, item.lastVisitTime || 0);
      group.pageTypes.add(detectPageType(item.url));
      group.urls.add(item.url);
      totalVisits++;
    }

    // Convert to array and sort
    const topDomains = [...domainGroups.values()]
      .map(g => ({
        ...g,
        pageTypes: [...g.pageTypes],
        urlCount: g.urls.size,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 20);

    // Store analysis
    await setStorage('historyAnalysis', {
      analyzedAt: getTimestamp(),
      totalVisits,
      uniqueDomains: domainGroups.size,
      topDomains,
    });

    console.log(`[Memora Bond] History analyzed: ${totalVisits} visits across ${domainGroups.size} domains`);
  } catch (err) {
    console.error('[Memora Bond] History analysis failed:', err);
  }
}

// ===== SEARCH ENGINE =====

async function searchMemories(query) {
  const memories = (await getStorage(STORAGE_KEYS.MEMORIES)) || [];
  const timeline = (await getStorage(STORAGE_KEYS.TIMELINE)) || [];

  if (!query || query.trim().length === 0) {
    return { memories: memories.slice(-50).reverse(), timeline: timeline.slice(-50).reverse(), total: memories.length };
  }

  const queryLower = query.toLowerCase().trim();
  const terms = queryLower.split(/\s+/).filter(t => t.length > 1);

  // Score each memory
  const scored = memories.map(memory => {
    let score = 0;
    const titleLower = (memory.title || '').toLowerCase();
    const descLower = (memory.description || '').toLowerCase();
    const textLower = (memory.textPreview || '').toLowerCase();
    const domainLower = (memory.domain || '').toLowerCase();
    const urlLower = (memory.url || '').toLowerCase();
    const tagsStr = (memory.tags || []).join(' ').toLowerCase();

    for (const term of terms) {
      if (titleLower.includes(term)) score += 10;
      if (domainLower.includes(term)) score += 8;
      if (tagsStr.includes(term)) score += 7;
      if (descLower.includes(term)) score += 5;
      if (textLower.includes(term)) score += 3;
      if (urlLower.includes(term)) score += 2;
    }

    // Boost by importance and recency
    score *= (1 + (memory.importance || 0.5));
    const ageHours = (getTimestamp() - (memory.lastVisited || 0)) / (1000 * 60 * 60);
    const recencyBoost = Math.max(0.1, 1 - (ageHours / 168)); // Decay over 7 days
    score *= recencyBoost;

    return { memory, score };
  });

  // Filter results with score > 0 and sort
  const results = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map(item => item.memory);

  // Also search timeline
  const timelineResults = timeline.filter(entry => {
    const titleLower = (entry.title || '').toLowerCase();
    const domainLower = (entry.domain || '').toLowerCase();
    return terms.some(term =>
      titleLower.includes(term) || domainLower.includes(term)
    );
  }).slice(-30).reverse();

  return { memories: results, timeline: timelineResults, total: results.length };
}

// ===== PRIVACY HELPER =====

function checkSettingsAndTrack(callback) {
  getStorage(STORAGE_KEYS.SETTINGS).then(settings => {
    if (settings?.isTracking) {
      callback(settings);
    }
  });
}

async function clearAllData() {
  await chrome.storage.local.clear();
  // Re-initialize
  await chrome.storage.local.set({
    memories: [],
    sessions: [],
    timeline: [],
    vault: [],
    settings: {
      isTracking: true,
      privacyMode: 'local',
      ignoreIncognito: true,
      ignoredDomains: [],
    },
  });
  activityBuffer.clear();
  workspaceContexts.clear();
  activeSession = null;
}

async function updateSettings(newSettings) {
  const current = (await getStorage(STORAGE_KEYS.SETTINGS)) || {};
  const merged = { ...current, ...newSettings };
  await setStorage(STORAGE_KEYS.SETTINGS, merged);
  return merged;
}

// ===== COMMUNICATION (Message Handler) =====

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      switch (message.type) {
        // ---- Data requests ----
        case 'GET_STATUS': {
          const memories = (await getStorage(STORAGE_KEYS.MEMORIES)) || [];
          const sessions = (await getStorage(STORAGE_KEYS.SESSIONS)) || [];
          const settings = await getStorage(STORAGE_KEYS.SETTINGS);
          const timeline = (await getStorage(STORAGE_KEYS.TIMELINE)) || [];
          const vault = (await getStorage(STORAGE_KEYS.VAULT)) || [];

          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayTimestamp = todayStart.getTime();

          const todayMemories = memories.filter(m => m.firstVisited >= todayTimestamp);
          const todayTimeline = timeline.filter(t => t.timestamp >= todayTimestamp);
          const todayDuration = sessions
            .filter(s => s.startTime >= todayTimestamp && s.duration)
            .reduce((sum, s) => sum + s.duration, 0);

          sendResponse({
            success: true,
            data: {
              isTracking: settings?.isTracking ?? true,
              totalMemories: memories.length,
              totalSessions: sessions.length,
              totalTimeline: timeline.length,
              totalVault: vault.length,
              todayMemories: todayMemories.length,
              todayTimeline: todayTimeline.length,
              todayDuration,
              activeSession: activeSession ? await generateSessionSummary(activeSession) : null,
              workspaces: buildWorkspaceSummary(),
              privacyMode: settings?.privacyMode || 'local',
            },
          });
          break;
        }

        case 'GET_MEMORIES': {
          const memories = (await getStorage(STORAGE_KEYS.MEMORIES)) || [];
          const limit = message.limit || 50;
          const offset = message.offset || 0;
          const tag = message.tag;

          let filtered = memories;
          if (tag) {
            filtered = memories.filter(m =>
              (m.tags || []).includes(tag)
            );
          }

          sendResponse({
            success: true,
            data: {
              memories: filtered.slice(-offset - limit, -offset || undefined).reverse(),
              total: filtered.length,
              hasMore: filtered.length > offset + limit,
            },
          });
          break;
        }

        case 'GET_SESSIONS': {
          const sessions = (await getStorage(STORAGE_KEYS.SESSIONS)) || [];
          const limit = message.limit || 20;
          sendResponse({
            success: true,
            data: sessions.slice(-limit).reverse(),
          });
          break;
        }

        case 'GET_TIMELINE': {
          const timeline = (await getStorage(STORAGE_KEYS.TIMELINE)) || [];
          const since = message.since || (Date.now() - 24 * 60 * 60 * 1000);
          const limit = message.limit || 100;

          const filtered = timeline.filter(t => t.timestamp >= since);
          sendResponse({
            success: true,
            data: filtered.slice(-limit).reverse(),
          });
          break;
        }

        case 'GET_VAULT': {
          const vault = (await getStorage(STORAGE_KEYS.VAULT)) || [];
          sendResponse({
            success: true,
            data: vault.slice(-50).reverse(),
          });
          break;
        }

        case 'SEARCH': {
          const results = await searchMemories(message.query);
          sendResponse({ success: true, data: results });
          break;
        }

        // ---- Actions ----
        case 'SAVE_MEMORY': {
          const memory = await saveManualMemory(message.data);
          sendResponse({ success: true, data: memory });
          break;
        }

        case 'DELETE_MEMORY': {
          const memories = (await getStorage(STORAGE_KEYS.MEMORIES)) || [];
          const idx = memories.findIndex(m => m.id === message.id);
          if (idx !== -1) {
            memories.splice(idx, 1);
            await setStorage(STORAGE_KEYS.MEMORIES, memories);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Memory not found' });
          }
          break;
        }

        case 'TOGGLE_TRACKING': {
          const settings = await getStorage(STORAGE_KEYS.SETTINGS);
          const newState = !settings?.isTracking;
          await updateSettings({ isTracking: newState });
          sendResponse({ success: true, data: { isTracking: newState } });
          break;
        }

        case 'UPDATE_SETTINGS': {
          const updated = await updateSettings(message.settings);
          sendResponse({ success: true, data: updated });
          break;
        }

        case 'CLEAR_DATA': {
          await clearAllData();
          sendResponse({ success: true });
          break;
        }

        case 'GET_SETTINGS': {
          const settings = await getStorage(STORAGE_KEYS.SETTINGS);
          sendResponse({ success: true, data: settings });
          break;
        }

        case 'END_SESSION': {
          if (activeSession) {
            await endSession(activeSession);
            activeSession = null;
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No active session' });
          }
          break;
        }

        case 'GET_HISTORY_ANALYSIS': {
          const analysis = await getStorage('historyAnalysis');
          sendResponse({ success: true, data: analysis });
          break;
        }

        // ---- Content script messages ----
        case 'CONTENT_EXTRACTED': {
          await processExtractedContent(message.content, message.metadata);
          sendResponse({ success: true });
          break;
        }

        case 'TEXT_SELECTED': {
          // Store selected text for quick saving
          const { selectedText, url, title, domain } = message;
          if (selectedText && selectedText.length > 10) {
            const selection = {
              id: generateId(),
              text: selectedText.substring(0, 5000),
              url,
              title,
              domain,
              timestamp: getTimestamp(),
              sessionId: activeSession?.id,
            };
            await addToStorage('textSelections', selection, 200);
          }
          sendResponse({ success: true });
          break;
        }

        case 'GET_WORKSPACES': {
          const workspaces = buildWorkspaceSummary();
          sendResponse({ success: true, data: workspaces });
          break;
        }

        // ---- Auth messages ----
        case 'AUTHENTICATE': {
          const result = await authenticate(message.token);
          sendResponse({ success: result.success, data: result });
          break;
        }

        case 'SIGN_IN_WEBSITE': {
          // Open the Memora Bond login page so user can sign in with Google
          chrome.tabs.create({ url: 'https://memora.bond/login?from=extension' });
          // Start background polling — popup will close when user clicks the new tab
          startAuthPolling();
          sendResponse({ success: true });
          break;
        }

        case 'CHECK_WEBSITE_AUTH': {
          // Popup asks for current auth status (one-shot check)
          try {
            const cookie = await chrome.cookies.get({
              url: 'https://memora.bond',
              name: 'memora_token',
            });
            if (cookie && cookie.value) {
              await authenticate(cookie.value);
              sendResponse({ success: true, authenticated: AUTH_STATE.isAuthenticated });
            } else {
              sendResponse({ success: true, authenticated: false });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
          break;
        }

        case 'GET_AUTH_STATUS': {
          sendResponse({
            success: true,
            data: {
              isAuthenticated: AUTH_STATE.isAuthenticated,
              userId: AUTH_STATE.userId,
              serverUrl: AUTH_STATE.serverUrl,
            },
          });
          break;
        }

        case 'LOGOUT': {
          AUTH_STATE.isAuthenticated = false;
          AUTH_STATE.userId = null;
          AUTH_STATE.token = null;
          await chrome.storage.local.remove(['authToken', 'authServerUrl', 'isAuthenticated']);
          sendResponse({ success: true });
          break;
        }

        // ---- Sync messages ----
        case 'SYNC_NOW': {
          const syncResult = await syncData();
          sendResponse({ success: true, data: syncResult });
          break;
        }

        case 'GET_SYNC_STATUS': {
          const syncStatus = await getSyncStatus();
          sendResponse({ success: true, data: syncStatus });
          break;
        }

        case 'REGISTER_DEVICE': {
          const deviceResult = await registerDevice();
          sendResponse({ success: true, data: deviceResult });
          break;
        }

        // ---- Agent messages ----
        case 'EXECUTE_AGENT': {
          const agentResult = await executeAgent(message.agentType, message.input);
          sendResponse({ success: true, data: agentResult });
          break;
        }

        case 'GET_AGENT_EXECUTIONS': {
          const executions = await getAgentExecutions();
          sendResponse({ success: true, data: executions });
          break;
        }

        case 'GET_CONTINUATION': {
          const suggestions = await checkContinuationSuggestions();
          sendResponse({ success: true, data: suggestions });
          break;
        }

        // ---- Multi-modal messages ----
        case 'CAPTURE_SCREENSHOT': {
          const screenshotResult = await captureScreenshot(message.tabId);
          sendResponse({ success: true, data: screenshotResult });
          break;
        }

        case 'PROCESS_IMAGE': {
          const imageResult = await processImage(message.imageData);
          sendResponse({ success: true, data: imageResult });
          break;
        }

        // ---- Knowledge Graph messages ----
        case 'GET_KNOWLEDGE_GRAPH': {
          const graphData = await getKnowledgeGraph();
          sendResponse({ success: true, data: graphData });
          break;
        }

        case 'TRIGGER_GRAPH_REBUILD': {
          const rebuildResult = await triggerGraphRebuild();
          sendResponse({ success: true, data: rebuildResult });
          break;
        }

        // ---- Import messages ----
        case 'GET_CONNECTORS': {
          const connectors = await getAvailableConnectors();
          sendResponse({ success: true, data: connectors });
          break;
        }

        case 'CREATE_IMPORT': {
          const importResult = await createImport(message.source, message.externalUrl);
          sendResponse({ success: true, data: importResult });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (err) {
      console.error('[Memora Bond] Message handler error:', err);
      sendResponse({ success: false, error: err.message });
    }
  };

  handleAsync();
  return true; // Keep channel open for async response
});

// ===== EVENT LISTENERS =====

// Tab lifecycle
chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onUpdated.addListener(handleTabUpdated);
chrome.tabs.onRemoved.addListener(handleTabRemoved);
chrome.tabs.onActivated.addListener(handleTabActivated);

// Window focus
chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

// Navigation (for SPA support)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab && !tab.incognito) {
        handleTabUpdated(details.tabId, {
          url: details.url,
          status: 'complete',
        }, tab);
      }
    });
  }
});

// Context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-memora') {
    let content = '';
    let title = '';
    let source = 'context_menu';

    if (info.selectionText) {
      content = info.selectionText;
      title = `Selection from ${tab?.title || 'Unknown'}`;
      source = 'selection';
    } else if (info.linkUrl) {
      content = `Link: ${info.linkUrl}`;
      title = `Link from ${tab?.title || 'Unknown'}`;
      source = 'link';
    } else {
      content = `Page: ${tab?.url || 'Unknown'}`;
      title = tab?.title || 'Saved Page';
    }

    await saveManualMemory({
      text: content,
      title,
      url: tab?.url,
      domain: getDomain(tab?.url),
      type: 'clip',
      source,
      tags: [source],
    });

    // Show a brief badge notification
    if (tab?.id) {
      chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tab.id });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }, 2000);
    }
  }

  if (info.menuItemId === 'capture-screenshot-memora') {
    await captureScreenshot(tab?.id);
  }
});

// Alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'processActivity') {
    // Process any buffered activity
    for (const [tabId] of activityBuffer.entries()) {
      await processTabActivity(tabId);
    }
  }

  if (alarm.name === 'endInactiveSessions') {
    await endInactiveSessions();
  }

  if (alarm.name === 'periodicSync') {
    if (AUTH_STATE.isAuthenticated) {
      await syncData();
    }
  }

  if (alarm.name === 'checkContinuations') {
    if (AUTH_STATE.isAuthenticated) {
      await checkContinuationSuggestions();
    }
  }
});

// Track tab replacement (e.g., when Chrome pre-renders)
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  const buffer = activityBuffer.get(removedTabId);
  if (buffer) {
    activityBuffer.delete(removedTabId);
    activityBuffer.set(addedTabId, buffer);
  }
});

// ===== INITIALIZATION =====

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Memora Bond] Extension ${details.reason}: v${chrome.runtime.getManifest().version}`);

  // Initialize storage with defaults
  const existing = await getStorage(STORAGE_KEYS.SETTINGS);
  if (!existing) {
    await chrome.storage.local.set({
      memories: [],
      sessions: [],
      timeline: [],
      vault: [],
      textSelections: [],
      settings: {
        isTracking: true,
        privacyMode: 'local',
        ignoreIncognito: true,
        ignoredDomains: [],
      },
    });
  }

  // Create periodic alarms
  chrome.alarms.create('processActivity', { periodInMinutes: 5 });
  chrome.alarms.create('endInactiveSessions', { periodInMinutes: 30 });
  chrome.alarms.create('periodicSync', { periodInMinutes: 5 });
  chrome.alarms.create('checkContinuations', { periodInMinutes: 10 });

  // Create context menus
  chrome.contextMenus.create({
    id: 'save-to-memora',
    title: 'Save to Memora Bond',
    contexts: ['selection', 'page', 'link'],
  });
  chrome.contextMenus.create({
    id: 'capture-screenshot-memora',
    title: 'Capture Screenshot to Memora Bond',
    contexts: ['page'],
  });

  // Run initial history analysis
  setTimeout(() => analyzeBrowsingHistory(), 5000);

  // Open side panel action
  chrome.action.setBadgeText({ text: '' });

  // Auto-authenticate from stored token
  await restoreAuth();

  // Restore critical in-memory state (MV3 service worker may restart)
  await restoreCriticalState();
});

// Handle extension startup (browser restart)
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Memora Bond] Browser started — resuming tracking');

  const settings = await getStorage(STORAGE_KEYS.SETTINGS);
  if (settings?.isTracking) {
    // Get the current active tab to resume session
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && !activeTab.incognito) {
      await ensureActiveSession(activeTab);
    }
  }

  // Restore auth on startup
  await restoreAuth();

  // Restore critical in-memory state
  await restoreCriticalState();
});

// Open side panel when action icon is clicked (can be triggered by popup)
chrome.action.onClicked.addListener(async (tab) => {
  // This only fires when there's no popup, but we have a popup
  // So this is a fallback
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// ===== AUTH POLLING (Background) =====
// The popup closes when the user clicks the login tab, so polling must happen here.

let _authPollingActive = false;

async function startAuthPolling() {
  if (_authPollingActive) return; // Already polling
  _authPollingActive = true;
  console.log('[Memora Bond] Starting background auth polling...');

  for (let i = 0; i < 150; i++) { // 5 minutes max (150 * 2s)
    try {
      const cookie = await chrome.cookies.get({
        url: 'https://memora.bond',
        name: 'memora_token',
      });
      if (cookie && cookie.value) {
        console.log('[Memora Bond] Found memora_token cookie, authenticating...');
        const result = await authenticate(cookie.value);
        if (result.success) {
          console.log('[Memora Bond] Extension authenticated via website sign-in!');
          _authPollingActive = false;
          return;
        }
      }
    } catch (err) {
      console.log('[Memora Bond] Auth poll error:', err.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('[Memora Bond] Auth polling timed out');
  _authPollingActive = false;
}

// ===== AUTH MODULE =====

const AUTH_STATE = {
  isAuthenticated: false,
  userId: null,
  token: null,
  serverUrl: 'https://memora.bond', // Will be overridden by stored setting
};

async function authenticate(idToken) {
  try {
    const serverUrl = AUTH_STATE.serverUrl;

    // Validate the token by sending it to the server
    const response = await fetch(`${serverUrl}/api/auth/extension-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Authentication failed');
    }
    const data = await response.json();

    AUTH_STATE.token = idToken; // Use the original Firebase ID token for all API calls
    AUTH_STATE.serverUrl = data.serverUrl || serverUrl;
    AUTH_STATE.isAuthenticated = true;

    await chrome.storage.local.set({
      authToken: idToken,
      authServerUrl: data.serverUrl || serverUrl,
      isAuthenticated: true,
    });

    // Register device after successful auth
    await registerDevice();

    // Trigger initial sync
    await syncData();

    console.log('[Memora Bond] Authenticated successfully');
    return { success: true };
  } catch (error) {
    console.error('[Memora Bond] Auth failed:', error);
    return { success: false, error: error.message };
  }
}

async function getAuthToken() {
  if (AUTH_STATE.token) return AUTH_STATE.token;
  const token = await getStorage('authToken');
  if (token) {
    AUTH_STATE.token = token;
    AUTH_STATE.userId = await getStorage('authUserId');
    AUTH_STATE.isAuthenticated = true;
  }
  return token;
}

async function restoreAuth() {
  try {
    const data = await chrome.storage.local.get(['authToken', 'authServerUrl', 'isAuthenticated']);
    if (data.authToken && data.isAuthenticated) {
      AUTH_STATE.token = data.authToken;
      AUTH_STATE.serverUrl = data.authServerUrl || AUTH_STATE.serverUrl;
      AUTH_STATE.isAuthenticated = true;
      console.log('[Memora Bond] Auth restored from stored token');
      return;
    }

    // Try to read token from website cookie (memora.bond)
    try {
      const cookie = await chrome.cookies.get({
        url: 'https://memora.bond',
        name: 'memora_token',
      });
      if (cookie && cookie.value) {
        console.log('[Memora Bond] Found token from website cookie, authenticating...');
        await authenticate(cookie.value);
      }
    } catch (cookieErr) {
      console.log('[Memora Bond] Could not read website cookie:', cookieErr.message);
    }
  } catch (err) {
    console.error('[Memora Bond] Failed to restore auth:', err);
  }
}

// ===== SYNC MODULE =====

const syncState = {
  deviceId: null,
  deviceName: `${typeof navigator !== 'undefined' ? navigator.platform : 'Unknown'} - Chrome`,
  lastSync: null,
  syncVersion: 0,
  status: 'offline',
};

async function registerDevice() {
  try {
    if (!AUTH_STATE.token) return;

    syncState.deviceId = syncState.deviceId || await getStorage('syncDeviceId') || generateId();
    await setStorage('syncDeviceId', syncState.deviceId);

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
      body: JSON.stringify({
        deviceId: syncState.deviceId,
        deviceName: syncState.deviceName,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      syncState.syncVersion = data.syncVersion || 0;
      syncState.status = 'connected';
      await setStorage('syncVersion', syncState.syncVersion);
      console.log('[Memora Bond] Device registered for sync');
    }
  } catch (err) {
    console.error('[Memora Bond] Device registration failed:', err);
    syncState.status = 'error';
  }
}

async function syncData() {
  try {
    if (!AUTH_STATE.token) {
      syncState.status = 'offline';
      return { status: 'offline' };
    }

    syncState.status = 'syncing';

    const currentVersion = await getStorage('syncVersion') || 0;
    const memories = (await getStorage(STORAGE_KEYS.MEMORIES)) || [];
    const sessions = (await getStorage(STORAGE_KEYS.SESSIONS)) || [];
    const timeline = (await getStorage(STORAGE_KEYS.TIMELINE)) || [];

    // Collect local changes — convert to server-expected format { type, action, data }
    const localChanges = [];

    // Sync ALL memories as create actions
    if (Array.isArray(memories)) {
      for (const m of memories) {
        localChanges.push({ type: 'memory', action: 'create', data: m });
      }
    }

    // Sync ended sessions
    if (Array.isArray(sessions)) {
      for (const s of sessions.filter(s => s.status === 'ended')) {
        localChanges.push({ type: 'session', action: 'create', data: s });
      }
    }

    // Sync ALL timeline events
    if (Array.isArray(timeline)) {
      for (const t of timeline) {
        localChanges.push({ type: 'timeline', action: 'create', data: t });
      }
    }

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/sync`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
      body: JSON.stringify({
        deviceId: syncState.deviceId,
        syncVersion: currentVersion,
        changes: localChanges,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      syncState.syncVersion = data.syncVersion || currentVersion;
      syncState.lastSync = getTimestamp();
      syncState.status = 'connected';
      await setStorage('syncVersion', syncState.syncVersion);
      await setStorage('lastSyncTime', syncState.lastSync);

      // Process remote changes
      if (data.remoteChanges) {
        await processRemoteChanges(data.remoteChanges);
      }

      console.log('[Memora Bond] Sync completed successfully');
      return { status: 'connected', syncVersion: syncState.syncVersion, lastSync: syncState.lastSync };
    }

    syncState.status = 'error';
    return { status: 'error' };
  } catch (err) {
    console.error('[Memora Bond] Sync failed:', err);
    syncState.status = 'error';
    return { status: 'error', error: err.message };
  }
}

async function processRemoteChanges(remoteChanges) {
  // Merge remote memories
  if (remoteChanges.memories && remoteChanges.memories.length > 0) {
    const localMemories = (await getStorage(STORAGE_KEYS.MEMORIES)) || [];
    const localIds = new Set(localMemories.map(m => m.id));

    let added = 0;
    for (const memory of remoteChanges.memories) {
      if (!localIds.has(memory.id)) {
        localMemories.push(memory);
        added++;
      }
    }

    if (added > 0) {
      await setStorage(STORAGE_KEYS.MEMORIES, localMemories.slice(-MAX_MEMORIES));
      console.log(`[Memora Bond] Merged ${added} remote memories`);
    }
  }
}

async function getSyncStatus() {
  const lastSync = await getStorage('lastSyncTime');
  const syncVersion = await getStorage('syncVersion');
  return {
    deviceId: syncState.deviceId,
    deviceName: syncState.deviceName,
    lastSync,
    syncVersion: syncVersion || 0,
    status: syncState.status,
    isAuthenticated: AUTH_STATE.isAuthenticated,
  };
}

// ===== AGENT BRIDGE MODULE =====

async function executeAgent(agentType, input) {
  try {
    if (!AUTH_STATE.token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
      body: JSON.stringify({ agentType, input }),
    });

    if (!response.ok) {
      return { success: false, error: `Agent execution failed: ${response.status}` };
    }

    const data = await response.json();

    // Store execution in local storage
    const execution = {
      id: data.id || generateId(),
      agentType,
      input,
      result: data.result,
      status: data.status || 'completed',
      timestamp: getTimestamp(),
    };
    await addToStorage('agentExecutions', execution, 100);

    return { success: true, data: execution };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getAgentExecutions() {
  const executions = (await getStorage('agentExecutions')) || [];
  return executions.slice(-20).reverse();
}

async function checkContinuationSuggestions() {
  try {
    if (!AUTH_STATE.token) {
      return { suggestions: [] };
    }

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/workflow/continuation`, {
      headers: {
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
    });

    if (!response.ok) {
      return { suggestions: [] };
    }

    const data = await response.json();

    if (data.suggestions && data.suggestions.length > 0) {
      // Show notification for interrupted work
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Memora Bond — Work Continuation',
        message: `You have ${data.suggestions.length} interrupted task${data.suggestions.length > 1 ? 's' : ''}. Click to continue.`,
      });
    }

    return { suggestions: data.suggestions || [] };
  } catch (err) {
    console.error('[Memora Bond] Continuation check failed:', err);
    return { suggestions: [] };
  }
}

// ===== MULTI-MODAL MEMORY MODULE =====

async function captureScreenshot(tabId) {
  try {
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = activeTab?.id;
    }
    if (!tabId) {
      return { success: false, error: 'No active tab' };
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

    // Get tab info for context
    const tab = await chrome.tabs.get(tabId);
    const metadata = {
      url: tab?.url,
      title: tab?.title,
      domain: getDomain(tab?.url),
      timestamp: getTimestamp(),
    };

    // Store locally
    const screenshot = {
      id: generateId(),
      type: 'screenshot',
      dataUrl,
      metadata,
      timestamp: getTimestamp(),
      processed: false,
    };
    await addToStorage('screenshots', screenshot, 50);

    // Send to server for AI analysis
    if (AUTH_STATE.isAuthenticated) {
      await processImage(dataUrl);
    }

    // Show badge confirmation
    chrome.action.setBadgeText({ text: '📸', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#06b6d4', tabId });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId });
    }, 2000);

    console.log('[Memora Bond] Screenshot captured');
    return { success: true, screenshotId: screenshot.id };
  } catch (err) {
    console.error('[Memora Bond] Screenshot capture failed:', err);
    return { success: false, error: err.message };
  }
}

async function processImage(imageData) {
  try {
    if (!AUTH_STATE.token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/memory/process-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
      body: JSON.stringify({ imageData }),
    });

    if (!response.ok) {
      return { success: false, error: 'Image processing failed' };
    }

    const data = await response.json();

    // Store AI analysis as a memory
    if (data.description || data.text) {
      await saveManualMemory({
        text: data.description || data.text,
        title: `Visual Memory: ${data.description?.substring(0, 60) || 'Screenshot Analysis'}`,
        type: 'visual',
        source: 'screenshot_analysis',
        tags: ['visual', 'screenshot', 'ai-analyzed'],
      });
    }

    return { success: true, data };
  } catch (err) {
    console.error('[Memora Bond] Image processing failed:', err);
    return { success: false, error: err.message };
  }
}

async function recordAudio() {
  // Placeholder for voice note capture via content script
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return { success: false, error: 'No active tab' };

    await chrome.tabs.sendMessage(activeTab.id, {
      type: 'START_AUDIO_RECORDING',
    });

    return { success: true, message: 'Audio recording started in content script' };
  } catch (err) {
    return { success: false, error: 'Content script not available for audio recording' };
  }
}

// ===== KNOWLEDGE GRAPH SYNC =====

async function getKnowledgeGraph() {
  try {
    const cached = await getStorage('knowledgeGraphCache');
    const cacheTime = await getStorage('knowledgeGraphCacheTime');

    // Return cached data if less than 10 minutes old
    if (cached && cacheTime && (getTimestamp() - cacheTime) < 10 * 60 * 1000) {
      return cached;
    }

    if (!AUTH_STATE.token) {
      return cached || { nodes: [], edges: [] };
    }

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/knowledge-graph`, {
      headers: {
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
    });

    if (!response.ok) {
      return cached || { nodes: [], edges: [] };
    }

    const data = await response.json();
    await setStorage('knowledgeGraphCache', data);
    await setStorage('knowledgeGraphCacheTime', getTimestamp());
    return data;
  } catch (err) {
    console.error('[Memora Bond] Knowledge graph fetch failed:', err);
    const cached = await getStorage('knowledgeGraphCache');
    return cached || { nodes: [], edges: [] };
  }
}

async function triggerGraphRebuild() {
  try {
    if (!AUTH_STATE.token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/knowledge-graph`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
    });

    // Clear cache
    await setStorage('knowledgeGraphCache', null);
    await setStorage('knowledgeGraphCacheTime', null);

    if (!response.ok) {
      return { success: false, error: 'Graph rebuild failed' };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===== MEMORY IMPORT BRIDGE =====

async function getAvailableConnectors() {
  try {
    if (!AUTH_STATE.token) {
      return { connectors: [
        { id: 'notion', name: 'Notion', icon: '📝', description: 'Import pages and databases from Notion' },
        { id: 'google-docs', name: 'Google Docs', icon: '📄', description: 'Import documents from Google Drive' },
        { id: 'obsidian', name: 'Obsidian', icon: '💎', description: 'Import markdown notes from Obsidian vaults' },
        { id: 'bookmark', name: 'Browser Bookmarks', icon: '🔖', description: 'Import your Chrome bookmarks' },
        { id: 'csv', name: 'CSV / Spreadsheet', icon: '📊', description: 'Import data from CSV files' },
      ] };
    }

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/import/connectors`, {
      headers: {
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
    });

    if (!response.ok) {
      return { connectors: [] };
    }

    return await response.json();
  } catch (err) {
    console.error('[Memora Bond] Failed to get connectors:', err);
    return { connectors: [] };
  }
}

async function createImport(source, externalUrl) {
  try {
    if (!AUTH_STATE.token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${AUTH_STATE.serverUrl}/api/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_STATE.token}`,
      },
      body: JSON.stringify({ source, externalUrl }),
    });

    if (!response.ok) {
      return { success: false, error: `Import failed: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

console.log('[Memora Bond] Background service worker loaded');
