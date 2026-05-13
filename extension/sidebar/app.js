// ============================================================
// Memora Bond — Sidebar Logic
// ============================================================

(function () {
  'use strict';

  // ===== STATE =====
  const state = {
    isTracking: true,
    currentPanel: 'dashboard',
    memoriesPage: 0,
    memoriesPerPage: 20,
    statusData: null,
    settings: null,
    refreshInterval: null,
  };

  // ===== DOM ELEMENTS =====
  const els = {
    // Nav
    navItems: document.querySelectorAll('.nav-item[data-panel]'),
    clearAllBtn: document.getElementById('clearAllBtn'),

    // Top bar
    panelTitle: document.getElementById('panelTitle'),
    panelSubtitle: document.getElementById('panelSubtitle'),
    trackingToggle: document.getElementById('trackingToggle'),
    trackingSwitch: document.getElementById('trackingSwitch'),
    trackingText: document.getElementById('trackingText'),
    searchInput: document.getElementById('searchInput'),

    // Dashboard
    statsGrid: document.getElementById('statsGrid'),
    sessionCard: document.getElementById('sessionCard'),
    workspacesList: document.getElementById('workspacesList'),
    workspaceCount: document.getElementById('workspaceCount'),

    // Timeline
    timelineContainer: document.getElementById('timelineContainer'),
    timelineCount: document.getElementById('timelineCount'),

    // Memories
    memoriesList: document.getElementById('memoriesList'),
    memoriesCount: document.getElementById('memoriesCount'),
    loadMoreMemories: document.getElementById('loadMoreMemories'),

    // Notes
    noteTextarea: document.getElementById('noteTextarea'),
    noteCharCount: document.getElementById('noteCharCount'),
    saveNoteBtn: document.getElementById('saveNoteBtn'),
    savedNotesList: document.getElementById('savedNotesList'),
    notesCount: document.getElementById('notesCount'),

    // Settings
    ignoredDomainsInput: document.getElementById('ignoredDomainsInput'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    clearDataBtnSettings: document.getElementById('clearDataBtnSettings'),

    // Agents
    agentTypeSelect: document.getElementById('agentTypeSelect'),
    agentInput: document.getElementById('agentInput'),
    executeAgentBtn: document.getElementById('executeAgentBtn'),
    agentsCount: document.getElementById('agentsCount'),
    agentExecutionsList: document.getElementById('agentExecutionsList'),
    checkContinuationsBtn: document.getElementById('checkContinuationsBtn'),
    continuationsList: document.getElementById('continuationsList'),
    captureScreenshotBtn: document.getElementById('captureScreenshotBtn'),
    syncNowBtn: document.getElementById('syncNowBtn'),

    // Auth
    authIndicator: document.getElementById('authIndicator'),
    authLabel: document.getElementById('authLabel'),

    // Search results
    searchResultsPanel: document.getElementById('searchResultsPanel'),
    searchBackBtn: document.getElementById('searchBackBtn'),
    searchQueryDisplay: document.getElementById('searchQueryDisplay'),
    searchResultsCount: document.getElementById('searchResultsCount'),
    searchResultsList: document.getElementById('searchResultsList'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),
  };

  // ===== HELPERS =====

  function sendMessage(type, data = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, ...data }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false });
          }
        });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  function formatTime(ms) {
    if (!ms) return '0m';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateTime(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function getMemoryIcon(type) {
    switch (type) {
      case 'note': return { class: 'note', symbol: '📝' };
      case 'clip': case 'selection': return { class: 'clip', symbol: '✂️' };
      default: return { class: 'page', symbol: '📄' };
    }
  }

  function getWorkspaceIcon(type) {
    const icons = {
      docs: '📄', code: '💻', social: '💬', email: '📧',
      video: '🎬', ai: '🤖', shopping: '🛒', general: '🌐',
    };
    return icons[type] || '🌐';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : '✕';
    toast.innerHTML = `<strong>${icon}</strong> ${escapeHtml(message)}`;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 3000);
  }

  // ===== NAVIGATION =====

  function switchPanel(panelName) {
    state.currentPanel = panelName;

    // Update nav items
    els.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.panel === panelName);
    });

    // Update panels
    document.querySelectorAll('.panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${panelName}`);
    });

    // Update title
    const titles = {
      dashboard: 'Dashboard',
      timeline: 'Timeline',
      memories: 'Memories',
      agents: 'Agents',
      notes: 'Quick Note',
      settings: 'Settings',
    };
    els.panelTitle.innerHTML = titles[panelName] || 'Dashboard';

    // Load panel data
    switch (panelName) {
      case 'dashboard': loadDashboard(); break;
      case 'timeline': loadTimeline(); break;
      case 'memories': loadMemories(0); break;
      case 'agents': loadAgents(); break;
      case 'notes': loadNotes(); break;
      case 'settings': loadSettings(); break;
    }
  }

  // ===== LOAD STATUS =====

  async function loadStatus() {
    const response = await sendMessage('GET_STATUS');
    if (!response.success) return;

    state.statusData = response.data;
    state.isTracking = response.data.isTracking;

    updateTrackingUI(state.isTracking);

    // Refresh current panel
    switchPanel(state.currentPanel);
  }

  function updateTrackingUI(isTracking) {
    if (isTracking) {
      els.trackingSwitch.classList.add('active');
      els.trackingText.textContent = 'Tracking';
    } else {
      els.trackingSwitch.classList.remove('active');
      els.trackingText.textContent = 'Paused';
    }
  }

  // ===== DASHBOARD =====

  async function loadDashboard() {
    if (!state.statusData) return;
    const data = state.statusData;

    // Stats
    els.statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-value green">${data.todayMemories || 0}</div>
        <div class="stat-label">Today's Memories</div>
      </div>
      <div class="stat-card">
        <div class="stat-value cyan">${data.totalMemories || 0}</div>
        <div class="stat-label">Total Memories</div>
      </div>
      <div class="stat-card">
        <div class="stat-value amber">${formatTime(data.todayDuration)}</div>
        <div class="stat-label">Today's Time</div>
      </div>
      <div class="stat-card">
        <div class="stat-value rose">${data.totalTimeline || 0}</div>
        <div class="stat-label">Total Events</div>
      </div>
    `;

    // Active session
    if (data.activeSession) {
      const s = data.activeSession;
      const domainChips = (s.domains || [])
        .slice(0, 8)
        .map(d => `<span class="domain-chip">${escapeHtml(d)}</span>`)
        .join('');

      els.sessionCard.innerHTML = `
        <div class="session-card">
          <div class="session-header">
            <div class="session-dot"></div>
            <div class="session-name">${escapeHtml(s.text?.split(':')[0] || 'Active Session')}</div>
          </div>
          <div class="session-stats">
            <div class="session-stat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${formatTime(s.duration)}
            </div>
            <div class="session-stat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              ${s.pageViews || 0} pages
            </div>
            <div class="session-stat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
              ${(s.domains || []).length} sites
            </div>
          </div>
          ${domainChips ? `<div class="domain-chips">${domainChips}</div>` : ''}
        </div>
      `;
    } else {
      els.sessionCard.innerHTML = `
        <div class="session-card">
          <div style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px;">
            No active session. Start browsing to begin!
          </div>
        </div>
      `;
    }

    // Workspaces
    const workspaces = data.workspaces || [];
    els.workspaceCount.textContent = workspaces.length;

    if (workspaces.length === 0) {
      els.workspacesList.innerHTML = `
        <div class="empty-state">
          <p>No active workspaces yet.</p>
        </div>
      `;
    } else {
      els.workspacesList.innerHTML = workspaces
        .slice(0, 10)
        .map(ws => `
          <div class="workspace-item">
            <div class="workspace-icon ${ws.category || 'general'}">
              ${getWorkspaceIcon(ws.category || 'general')}
            </div>
            <div class="workspace-info">
              <div class="workspace-domain">${escapeHtml(ws.domain)}</div>
              <div class="workspace-meta">${ws.tabCount} tab${ws.tabCount !== 1 ? 's' : ''} · ${timeAgo(ws.lastSeen)}</div>
            </div>
          </div>
        `)
        .join('');
    }
  }

  // ===== TIMELINE =====

  async function loadTimeline() {
    const since = Date.now() - (24 * 60 * 60 * 1000);
    const response = await sendMessage('GET_TIMELINE', { since, limit: 200 });
    if (!response.success) return;

    const entries = response.data || [];
    els.timelineCount.textContent = entries.length;

    if (entries.length === 0) {
      els.timelineContainer.innerHTML = `
        <div class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>No activity recorded today.</p>
        </div>
      `;
      return;
    }

    // Group by hour
    const groups = new Map();
    entries.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      const label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(entry);
    });

    let html = '';
    for (const [label, items] of groups) {
      html += `<div class="timeline-group">`;
      html += `<div class="timeline-group-label">${label}</div>`;

      items.forEach(entry => {
        html += `
          <div class="timeline-item type-${entry.type || 'page'}" data-url="${escapeHtml(entry.url || '')}">
            <div class="timeline-line"></div>
            <div class="timeline-content">
              <div class="timeline-title">${escapeHtml(entry.title || 'Untitled')}</div>
              <div class="timeline-meta">
                ${formatTimestamp(entry.timestamp)} · ${escapeHtml(entry.domain || '')}
                ${entry.pageType ? ` · ${entry.pageType}` : ''}
              </div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    els.timelineContainer.innerHTML = html;

    // Wire clicks
    els.timelineContainer.querySelectorAll('.timeline-item[data-url]').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });
  }

  // ===== MEMORIES =====

  async function loadMemories(offset = 0) {
    if (offset === 0) state.memoriesPage = 0;

    const response = await sendMessage('GET_MEMORIES', {
      limit: state.memoriesPerPage,
      offset: offset,
    });

    if (!response.success) return;

    const { memories, total, hasMore } = response.data;
    els.memoriesCount.textContent = total;

    if (memories.length === 0 && offset === 0) {
      els.memoriesList.innerHTML = `
        <div class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <p>No memories stored yet. Browse the web to start building your memory!</p>
        </div>
      `;
      els.loadMoreMemories.style.display = 'none';
      return;
    }

    const html = memories.map(memory => {
      const icon = getMemoryIcon(memory.type);
      const tags = (memory.tags || []).slice(0, 3).map(t => `<span class="memory-tag">${escapeHtml(t)}</span>`).join('');

      return `
        <div class="memory-card" data-id="${memory.id}" data-url="${escapeHtml(memory.url || '')}">
          <div class="memory-type-icon ${icon.class}">${icon.symbol}</div>
          <div class="memory-body">
            <div class="memory-title">${escapeHtml(memory.title || 'Untitled')}</div>
            ${memory.description ? `<div class="memory-desc">${escapeHtml(memory.description.substring(0, 150))}</div>` : ''}
            <div class="memory-footer">
              <span>${escapeHtml(memory.domain || 'unknown')}</span>
              <span>·</span>
              <span>${timeAgo(memory.lastVisited)}</span>
              ${tags ? `<span>·</span>${tags}` : ''}
            </div>
          </div>
          <div class="memory-actions">
            <button class="memory-delete" data-id="${memory.id}" title="Delete memory">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (offset === 0) {
      els.memoriesList.innerHTML = html;
    } else {
      els.memoriesList.insertAdjacentHTML('beforeend', html);
    }

    els.loadMoreMemories.style.display = hasMore ? 'block' : 'none';

    // Wire events
    wireMemoryEvents();
  }

  function wireMemoryEvents() {
    // Click to open URL
    els.memoriesList.querySelectorAll('.memory-card[data-url]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.memory-delete')) return;
        const url = card.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });

    // Delete buttons
    els.memoriesList.querySelectorAll('.memory-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const response = await sendMessage('DELETE_MEMORY', { id });
        if (response.success) {
          btn.closest('.memory-card').remove();
          showToast('Memory deleted');
        }
      });
    });
  }

  // ===== NOTES =====

  async function loadNotes() {
    const response = await sendMessage('GET_MEMORIES', { limit: 50 });
    if (!response.success) return;

    const notes = (response.data.memories || []).filter(m => m.type === 'note' || m.source === 'manual');
    els.notesCount.textContent = notes.length;

    if (notes.length === 0) {
      els.savedNotesList.innerHTML = `
        <div class="empty-state">
          <p>No notes yet. Write your first note above!</p>
        </div>
      `;
      return;
    }

    els.savedNotesList.innerHTML = notes
      .reverse()
      .map(note => `
        <div class="saved-note-card">
          <div class="note-content">${escapeHtml(note.description || note.textPreview || '')}</div>
          <div class="note-time">${formatDateTime(note.firstVisited)}</div>
        </div>
      `)
      .join('');
  }

  async function saveNote() {
    const text = els.noteTextarea.value.trim();
    if (!text) return;

    const response = await sendMessage('SAVE_MEMORY', {
      data: {
        text,
        title: `Note: ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`,
        type: 'note',
        source: 'sidebar_note',
        tags: ['note', 'manual'],
      },
    });

    if (response.success) {
      els.noteTextarea.value = '';
      els.noteCharCount.textContent = '0';
      els.saveNoteBtn.disabled = true;
      showToast('Note saved!');
      loadNotes();
    } else {
      showToast('Failed to save note', 'error');
    }
  }

  // ===== SETTINGS =====

  async function loadSettings() {
    const response = await sendMessage('GET_SETTINGS');
    if (!response.success) return;

    state.settings = response.data || {};
    els.ignoredDomainsInput.value = (state.settings.ignoredDomains || []).join('\n');
  }

  async function saveSettings() {
    const domainsText = els.ignoredDomainsInput.value.trim();
    const ignoredDomains = domainsText
      .split('\n')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);

    const response = await sendMessage('UPDATE_SETTINGS', { settings: { ignoredDomains } });
    if (response.success) {
      state.settings = response.data;
      showToast('Settings saved!');
    } else {
      showToast('Failed to save settings', 'error');
    }
  }

  // ===== SEARCH =====

  let searchTimeout = null;

  function handleSearch(query) {
    if (searchTimeout) clearTimeout(searchTimeout);

    if (!query || query.trim().length === 0) {
      els.searchResultsPanel.classList.remove('active');
      return;
    }

    searchTimeout = setTimeout(async () => {
      const response = await sendMessage('SEARCH', { query: query.trim() });
      if (!response.success) return;

      const { memories: results, total } = response.data;

      els.searchQueryDisplay.textContent = query.trim();
      els.searchResultsCount.textContent = `${total} result${total !== 1 ? 's' : ''} found`;
      els.searchResultsPanel.classList.add('active');

      if (results.length === 0) {
        els.searchResultsList.innerHTML = `
          <div class="empty-state">
            <p>No results for "${escapeHtml(query.trim())}"</p>
          </div>
        `;
        return;
      }

      els.searchResultsList.innerHTML = results
        .slice(0, 30)
        .map(memory => {
          const icon = getMemoryIcon(memory.type);
          return `
            <div class="memory-card" data-url="${escapeHtml(memory.url || '')}">
              <div class="memory-type-icon ${icon.class}">${icon.symbol}</div>
              <div class="memory-body">
                <div class="memory-title">${escapeHtml(memory.title || 'Untitled')}</div>
                <div class="memory-desc">${escapeHtml((memory.description || memory.textPreview || '').substring(0, 120))}</div>
                <div class="memory-footer">
                  <span>${escapeHtml(memory.domain || 'unknown')}</span>
                  <span>·</span>
                  <span>${timeAgo(memory.lastVisited)}</span>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      // Wire clicks
      els.searchResultsList.querySelectorAll('.memory-card[data-url]').forEach(card => {
        card.addEventListener('click', () => {
          const url = card.dataset.url;
          if (url) chrome.tabs.create({ url });
        });
      });
    }, 300);
  }

  // ===== TOGGLE TRACKING =====

  async function toggleTracking() {
    const response = await sendMessage('TOGGLE_TRACKING');
    if (!response.success) return;

    state.isTracking = response.data.isTracking;
    updateTrackingUI(state.isTracking);
    showToast(state.isTracking ? 'Tracking resumed' : 'Tracking paused');
  }

  // ===== CLEAR DATA =====

  async function clearAllData() {
    if (!confirm('⚠️ Are you sure you want to clear ALL Memora Bond data?\n\nThis will permanently delete all memories, sessions, timeline events, and notes. This cannot be undone.')) {
      return;
    }

    const response = await sendMessage('CLEAR_DATA');
    if (response.success) {
      showToast('All data cleared');
      loadStatus();
    } else {
      showToast('Failed to clear data', 'error');
    }
  }

  // ===== AGENTS =====

  async function loadAgents() {
    // Load agent executions
    const executionsResponse = await sendMessage('GET_AGENT_EXECUTIONS');
    if (executionsResponse.success && executionsResponse.data) {
      const executions = executionsResponse.data;
      els.agentsCount.textContent = executions.length;

      if (executions.length === 0) {
        els.agentExecutionsList.innerHTML = `
          <div class="empty-state" style="padding:16px 0;">
            <p>No agent executions yet.</p>
          </div>
        `;
      } else {
        const agentIcons = {
          research: '🔍', summarize: '📝', code: '💻',
          organize: '📋', workflow: '🔄',
        };
        els.agentExecutionsList.innerHTML = executions
          .slice(0, 10)
          .map(exec => `
            <div class="agent-execution-card">
              <div class="agent-execution-header">
                <div class="agent-execution-type">
                  <span>${agentIcons[exec.agentType] || '🤖'}</span>
                  ${escapeHtml(exec.agentType || 'unknown')}
                </div>
                <span class="agent-execution-status ${exec.status || 'completed'}">${exec.status || 'completed'}</span>
              </div>
              <div class="agent-execution-input" title="${escapeHtml(exec.input || '')}">${escapeHtml(exec.input || 'No input')}</div>
              <div class="agent-execution-time">${timeAgo(exec.timestamp)}</div>
            </div>
          `)
          .join('');
      }
    } else {
      els.agentsCount.textContent = '0';
    }

    // Load continuations
    loadContinuations();
  }

  async function executeAgent() {
    const agentType = els.agentTypeSelect.value;
    const input = els.agentInput.value.trim();
    if (!input) {
      showToast('Please describe what the agent should do', 'error');
      return;
    }

    els.executeAgentBtn.disabled = true;
    els.executeAgentBtn.textContent = 'Executing...';

    try {
      const response = await sendMessage('EXECUTE_AGENT', { agentType, input });
      if (response.success) {
        showToast('Agent executed successfully');
        els.agentInput.value = '';
        loadAgents();
      } else {
        showToast(response.error || 'Agent execution failed', 'error');
      }
    } catch (e) {
      showToast('Agent execution failed', 'error');
    }

    els.executeAgentBtn.disabled = false;
    els.executeAgentBtn.textContent = 'Execute Agent';
  }

  async function loadContinuations() {
    const response = await sendMessage('GET_CONTINUATION');
    if (!response.success) return;

    const suggestions = response.data?.suggestions || [];
    if (suggestions.length === 0) {
      els.continuationsList.innerHTML = `
        <div class="empty-state" style="padding:16px 0;">
          <p>No continuation suggestions yet.</p>
        </div>
      `;
      return;
    }

    els.continuationsList.innerHTML = suggestions
      .slice(0, 5)
      .map(sug => `
        <div class="continuation-card" data-context="${escapeHtml(sug.context || '')}">
          <div class="continuation-title">${escapeHtml(sug.title || 'Continue Work')}</div>
          <div class="continuation-desc">${escapeHtml(sug.description || '')}</div>
        </div>
      `)
      .join('');
  }

  async function checkContinuations() {
    const btn = els.checkContinuationsBtn;
    btn.classList.add('spinning');
    try {
      const response = await sendMessage('GET_CONTINUATION');
      if (response.success) {
        loadContinuations();
        const suggestions = response.data?.suggestions || [];
        showToast(suggestions.length > 0 ? `Found ${suggestions.length} suggestion(s)` : 'No suggestions found');
      }
    } catch (e) {
      showToast('Failed to check continuations', 'error');
    }
    btn.classList.remove('spinning');
  }

  async function captureScreenshot() {
    const response = await sendMessage('CAPTURE_SCREENSHOT');
    if (response.success) {
      showToast('Screenshot captured');
    } else {
      showToast(response.error || 'Failed to capture screenshot', 'error');
    }
  }

  async function syncNow() {
    showToast('Syncing...');
    const response = await sendMessage('SYNC_NOW');
    if (response.success) {
      const data = response.data;
      if (data.status === 'connected') {
        showToast('Sync completed');
      } else if (data.status === 'offline') {
        showToast('Not authenticated — login first', 'error');
      } else {
        showToast('Sync failed', 'error');
      }
    } else {
      showToast('Sync failed', 'error');
    }
  }

  // ===== AUTH =====

  async function loadAuthStatus() {
    const response = await sendMessage('GET_AUTH_STATUS');
    if (response.success) {
      const { isAuthenticated } = response.data;
      if (isAuthenticated) {
        els.authIndicator.classList.add('connected');
        els.authLabel.textContent = 'Connected';
      } else {
        els.authIndicator.classList.remove('connected');
        els.authLabel.textContent = 'Offline';
      }
    }
  }

  // ===== EVENT LISTENERS =====

  // Navigation
  els.navItems.forEach(item => {
    item.addEventListener('click', () => switchPanel(item.dataset.panel));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchPanel(item.dataset.panel);
      }
    });
  });

  // Tracking toggle
  els.trackingToggle.addEventListener('click', toggleTracking);

  // Search
  els.searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      els.searchInput.value = '';
      els.searchResultsPanel.classList.remove('active');
    }
  });

  // Search back button
  els.searchBackBtn.addEventListener('click', () => {
    els.searchResultsPanel.classList.remove('active');
    els.searchInput.value = '';
    els.searchInput.focus();
  });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      els.searchInput.focus();
    }
    if (e.key === 'Escape' && els.searchResultsPanel.classList.contains('active')) {
      els.searchResultsPanel.classList.remove('active');
      els.searchInput.value = '';
    }
  });

  // Load more memories
  els.loadMoreMemories.addEventListener('click', () => {
    state.memoriesPage++;
    const offset = state.memoriesPage * state.memoriesPerPage;
    loadMemories(offset);
  });

  // Notes
  els.noteTextarea.addEventListener('input', () => {
    const len = els.noteTextarea.value.length;
    els.noteCharCount.textContent = len;
    els.saveNoteBtn.disabled = len === 0;
  });
  els.saveNoteBtn.addEventListener('click', saveNote);

  // Ctrl+Enter to save note
  els.noteTextarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      saveNote();
    }
  });

  // Settings
  els.saveSettingsBtn.addEventListener('click', saveSettings);
  els.clearDataBtnSettings.addEventListener('click', clearAllData);

  // Agents
  if (els.executeAgentBtn) els.executeAgentBtn.addEventListener('click', executeAgent);
  if (els.checkContinuationsBtn) els.checkContinuationsBtn.addEventListener('click', checkContinuations);
  if (els.captureScreenshotBtn) els.captureScreenshotBtn.addEventListener('click', captureScreenshot);
  if (els.syncNowBtn) els.syncNowBtn.addEventListener('click', syncNow);

  // Auth
  if (els.authIndicator) els.authIndicator.addEventListener('click', () => {
    switchPanel('settings');
  });

  // Clear all (nav)
  if (els.clearAllBtn) {
    els.clearAllBtn.addEventListener('click', clearAllData);
  }

  // ===== INITIALIZATION =====

  async function init() {
    // Load initial data
    await loadStatus();
    await loadAuthStatus();

    // Set up periodic refresh (every 30 seconds)
    state.refreshInterval = setInterval(() => {
      loadStatus();
      loadAuthStatus();
    }, 30000);
  }

  init();

})();
