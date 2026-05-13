// ============================================================
// Memora Bond — Popup Logic
// ============================================================

(function () {
  'use strict';

  // ===== DOM ELEMENTS =====
  const els = {
    trackingToggle: document.getElementById('trackingToggle'),
    trackingDot: document.getElementById('trackingDot'),
    trackingLabel: document.getElementById('trackingLabel'),
    searchInput: document.getElementById('searchInput'),
    statToday: document.getElementById('statToday'),
    statTotal: document.getElementById('statTotal'),
    statDuration: document.getElementById('statDuration'),
    sessionContent: document.getElementById('sessionContent'),
    memoriesContent: document.getElementById('memoriesContent'),
    searchResults: document.getElementById('searchResults'),
    searchResultsContent: document.getElementById('searchResultsContent'),
    openSidebarBtn: document.getElementById('openSidebarBtn'),
    openDashboardBtn: document.getElementById('openDashboardBtn'),
    clearDataBtn: document.getElementById('clearDataBtn'),
    contentArea: document.getElementById('contentArea'),
    // New elements
    authDot: document.getElementById('authDot'),
    authStatusText: document.getElementById('authStatusText'),
    syncDot: document.getElementById('syncDot'),
    syncStatusText: document.getElementById('syncStatusText'),
    agentsBadge: document.getElementById('agentsBadge'),
    agentsRunningCount: document.getElementById('agentsRunningCount'),
    syncNowBtn: document.getElementById('syncNowBtn'),
    // Settings panel
    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsServerUrl: document.getElementById('settingsServerUrl'),
    settingsStatus: document.getElementById('settingsStatus'),
    settingsOpenWebBtn: document.getElementById('settingsOpenWebBtn'),
    settingsDisconnectBtn: document.getElementById('settingsDisconnectBtn'),
    signInBtn: document.getElementById('signInBtn'),
  };

  let state = {
    isTracking: true,
    status: null,
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

  function timeAgo(timestamp) {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
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
      case 'note':
        return { class: 'note', symbol: '📝' };
      case 'clip':
      case 'selection':
        return { class: 'clip', symbol: '✂️' };
      default:
        return { class: 'page', symbol: '📄' };
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ===== LOAD STATUS =====

  async function loadStatus() {
    const response = await sendMessage('GET_STATUS');
    if (!response.success) return;

    state.status = response.data;
    state.isTracking = response.data.isTracking;
    renderStatus(response.data);
    await loadMemories();
  }

  // ===== SETTINGS PANEL =====

  let authData = null; // Store auth data for settings panel

  function openSettings() {
    if (authData) {
      els.settingsServerUrl.textContent = authData.serverUrl || '—';
      els.settingsStatus.textContent = authData.isAuthenticated ? 'Connected' : 'Not Connected';
      els.settingsStatus.className = 'settings-value' + (authData.isAuthenticated ? ' connected' : '');
    }
    els.settingsOverlay.classList.add('open');
  }

  function closeSettings() {
    els.settingsOverlay.classList.remove('open');
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect from Memora Bond cloud? Your local data will be preserved.')) return;

    const response = await sendMessage('LOGOUT');
    if (response.success) {
      authData = { isAuthenticated: false, serverUrl: '—' };
      els.settingsStatus.textContent = 'Not Connected';
      els.settingsStatus.className = 'settings-value';
      els.authDot.className = 'indicator-dot offline';
      els.authStatusText.textContent = 'Offline';
      els.syncDot.className = 'indicator-dot offline';
      els.syncStatusText.textContent = 'Not synced';
      closeSettings();
    }
  }

  function openWebSettings() {
    const url = authData?.serverUrl
      ? `${authData.serverUrl}/settings`
      : 'https://memora.bond/settings';
    chrome.tabs.create({ url });
    window.close();
  }

  async function loadAuthAndSync() {
    // Auth status
    const authResponse = await sendMessage('GET_AUTH_STATUS');
    if (authResponse.success) {
      authData = authResponse.data;
      const { isAuthenticated } = authResponse.data;
      if (isAuthenticated) {
        els.authDot.className = 'indicator-dot online';
        els.authStatusText.textContent = 'Connected';
        if (els.signInBtn) els.signInBtn.style.display = 'none';
      } else {
        els.authDot.className = 'indicator-dot offline';
        els.authStatusText.textContent = 'Offline';
        if (els.signInBtn) els.signInBtn.style.display = 'flex';
      }
    }

    // Sync status
    const syncResponse = await sendMessage('GET_SYNC_STATUS');
    if (syncResponse.success) {
      const data = syncResponse.data;
      if (data.status === 'connected' && data.lastSync) {
        els.syncDot.className = 'indicator-dot online';
        els.syncStatusText.textContent = `Synced ${timeAgo(data.lastSync)}`;
      } else if (data.status === 'syncing') {
        els.syncDot.className = 'indicator-dot syncing';
        els.syncStatusText.textContent = 'Syncing...';
      } else {
        els.syncDot.className = 'indicator-dot offline';
        els.syncStatusText.textContent = 'Not synced';
      }
    }

    // Agents count
    const agentsResponse = await sendMessage('GET_AGENT_EXECUTIONS');
    if (agentsResponse.success && agentsResponse.data) {
      const runningCount = agentsResponse.data.filter(e => e.status === 'running').length;
      if (runningCount > 0) {
        els.agentsBadge.style.display = 'flex';
        els.agentsRunningCount.textContent = runningCount;
      } else {
        els.agentsBadge.style.display = 'none';
      }
    }
  }

  async function handleSignIn() {
    if (els.signInBtn) els.signInBtn.disabled = true;
    await sendMessage('SIGN_IN_WEBSITE');
  }

  async function pollForAuth() {
    // Poll every 2 seconds for 60 seconds to check if user signed in on website
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const response = await sendMessage('CHECK_WEBSITE_AUTH');
      if (response.success && response.authenticated) {
        els.authDot.className = 'indicator-dot online';
        els.authStatusText.textContent = 'Connected';
        if (els.signInBtn) els.signInBtn.style.display = 'none';
        await loadAuthAndSync();
        return;
      }
    }
    if (els.signInBtn) els.signInBtn.disabled = false;
  }

  async function handleSyncNow() {
    els.syncDot.className = 'indicator-dot syncing';
    els.syncStatusText.textContent = 'Syncing...';

    const response = await sendMessage('SYNC_NOW');
    if (response.success) {
      const data = response.data;
      if (data.status === 'connected') {
        els.syncDot.className = 'indicator-dot online';
        els.syncStatusText.textContent = 'Just synced';
      } else if (data.status === 'offline') {
        els.syncDot.className = 'indicator-dot offline';
        els.syncStatusText.textContent = 'Not authenticated';
      } else {
        els.syncDot.className = 'indicator-dot offline';
        els.syncStatusText.textContent = 'Sync failed';
      }
    } else {
      els.syncDot.className = 'indicator-dot offline';
      els.syncStatusText.textContent = 'Sync failed';
    }
  }

  // ===== RENDER STATUS =====

  function renderStatus(data) {
    // Stats
    els.statToday.textContent = data.todayMemories || 0;
    els.statTotal.textContent = data.totalMemories || 0;
    els.statDuration.textContent = formatTime(data.todayDuration);

    // Tracking indicator
    updateTrackingUI(state.isTracking);

    // Session
    if (data.activeSession) {
      const s = data.activeSession;
      const domainsHtml = (s.domains || [])
        .slice(0, 5)
        .map(d => `<span class="session-domain-tag">${escapeHtml(d)}</span>`)
        .join('');

      els.sessionContent.innerHTML = `
        <div class="session-card">
          <div class="session-title">
            <div class="session-dot"></div>
            ${escapeHtml(s.text?.split(':')[0] || 'Active Session')}
          </div>
          <div class="session-meta">
            <span>🌐 ${s.pageViews || 0} pages</span>
            <span>⏱ ${formatTime(s.duration)}</span>
          </div>
          ${domainsHtml ? `<div class="session-domains">${domainsHtml}</div>` : ''}
        </div>
      `;
    } else {
      els.sessionContent.innerHTML = `
        <div class="no-session">No active session — start browsing!</div>
      `;
    }
  }

  // ===== LOAD MEMORIES =====

  async function loadMemories() {
    const response = await sendMessage('GET_MEMORIES', { limit: 5 });
    if (!response.success) return;

    const { memories } = response.data;

    if (memories.length === 0) {
      els.memoriesContent.innerHTML = `
        <div class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <p>No memories yet. Start browsing to build your memory!</p>
        </div>
      `;
      return;
    }

    els.memoriesContent.innerHTML = memories
      .map(memory => {
        const icon = getMemoryIcon(memory.type);
        return `
          <div class="memory-item" data-url="${escapeHtml(memory.url || '')}" title="${escapeHtml(memory.title || 'Untitled')}">
            <div class="memory-icon ${icon.class}">${icon.symbol}</div>
            <div class="memory-info">
              <div class="memory-title">${escapeHtml(memory.title || 'Untitled')}</div>
              <div class="memory-domain">${escapeHtml(memory.domain || 'unknown')}</div>
            </div>
            <div class="memory-time">${timeAgo(memory.lastVisited)}</div>
          </div>
        `;
      })
      .join('');

    // Click to open URL
    els.memoriesContent.querySelectorAll('.memory-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) {
          chrome.tabs.create({ url });
        }
      });
    });
  }

  // ===== SEARCH =====

  let searchTimeout = null;

  function handleSearch(query) {
    if (searchTimeout) clearTimeout(searchTimeout);

    if (!query || query.trim().length === 0) {
      els.searchResults.style.display = 'none';
      return;
    }

    searchTimeout = setTimeout(async () => {
      const response = await sendMessage('SEARCH', { query: query.trim() });
      if (!response.success) return;

      const { memories: results, timeline } = response.data;

      if (results.length === 0 && timeline.length === 0) {
        els.searchResults.style.display = 'block';
        els.searchResultsContent.innerHTML = `
          <div class="empty-state">
            <p>No results found for "${escapeHtml(query.trim())}"</p>
          </div>
        `;
        return;
      }

      let html = '';

      if (results.length > 0) {
        html += results
          .slice(0, 10)
          .map(memory => {
            const icon = getMemoryIcon(memory.type);
            return `
              <div class="memory-item" data-url="${escapeHtml(memory.url || '')}">
                <div class="memory-icon ${icon.class}">${icon.symbol}</div>
                <div class="memory-info">
                  <div class="memory-title">${escapeHtml(memory.title || 'Untitled')}</div>
                  <div class="memory-domain">${escapeHtml(memory.domain || 'unknown')}</div>
                </div>
                <div class="memory-time">${timeAgo(memory.lastVisited)}</div>
              </div>
            `;
          })
          .join('');
      }

      els.searchResultsContent.innerHTML = html;
      els.searchResults.style.display = 'block';

      // Wire up clicks
      els.searchResultsContent.querySelectorAll('.memory-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.dataset.url;
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
  }

  function updateTrackingUI(isTracking) {
    const toggle = els.trackingToggle;
    const dot = els.trackingDot;
    const label = els.trackingLabel;

    if (isTracking) {
      toggle.classList.add('active');
      toggle.setAttribute('aria-checked', 'true');
      dot.className = 'dot active';
      label.textContent = 'Tracking active';
    } else {
      toggle.classList.remove('active');
      toggle.setAttribute('aria-checked', 'false');
      dot.className = 'dot paused';
      label.textContent = 'Tracking paused';
    }
  }

  // ===== ACTIONS =====

  async function openSidePanel() {
    try {
      await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
      window.close();
    } catch (e) {
      // Fallback: open sidebar in new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('sidebar/index.html') });
      window.close();
    }
  }

  function openDashboard() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('sidebar/index.html'),
    });
    window.close();
  }

  async function clearData() {
    if (!confirm('Are you sure you want to clear all Memora Bond data? This cannot be undone.')) return;

    const response = await sendMessage('CLEAR_DATA');
    if (response.success) {
      // Reload status
      await loadStatus();
    }
  }

  // ===== EVENT LISTENERS =====

  // Tracking toggle
  els.trackingToggle.addEventListener('click', toggleTracking);
  els.trackingToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTracking();
    }
  });

  // Search
  els.searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      els.searchInput.value = '';
      els.searchResults.style.display = 'none';
    }
  });

  // Keyboard shortcut (Cmd/Ctrl+K)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      els.searchInput.focus();
    }
  });

  // Action buttons
  els.openSidebarBtn.addEventListener('click', openSidePanel);
  els.openDashboardBtn.addEventListener('click', openDashboard);
  els.clearDataBtn.addEventListener('click', clearData);
  if (els.syncNowBtn) els.syncNowBtn.addEventListener('click', handleSyncNow);

  // Settings panel
  if (els.settingsBtn) els.settingsBtn.addEventListener('click', openSettings);
  if (els.settingsOverlay) els.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === els.settingsOverlay) closeSettings();
  });
  if (els.settingsDisconnectBtn) els.settingsDisconnectBtn.addEventListener('click', handleDisconnect);
  if (els.settingsOpenWebBtn) els.settingsOpenWebBtn.addEventListener('click', openWebSettings);
  if (els.signInBtn) els.signInBtn.addEventListener('click', () => { handleSignIn(); pollForAuth(); });

  // ===== INIT =====
  loadStatus();
  loadAuthAndSync();

})();
