// ============================================================
// Memora Bond — AI Browser Memory Extension
// Content Script — Page Monitoring & Interaction
// ============================================================

(function () {
  'use strict';

  // ===== GUARD: Skip on sensitive, incognito, or excluded pages =====
  const SENSITIVE_PATTERNS = [
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

  const currentUrl = window.location.href;
  const currentDomain = window.location.hostname.replace(/^www\./, '');

  // Check if we should run on this page
  const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(currentDomain + currentUrl));
  const isPdf = document.contentType === 'application/pdf';
  const isExtensionPage = currentUrl.startsWith('chrome-extension://');
  const isBrowserPage = currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://') || currentUrl.startsWith('about:');

  if (isSensitive || isPdf || isExtensionPage || isBrowserPage) {
    return; // Exit early
  }

  // ===== STATE =====
  let lastUrl = currentUrl;
  let lastTitle = document.title;
  let selectionTimeout = null;
  let memoraButton = null;
  let isInitialized = false;
  let pageContent = null;

  // ===== PAGE TYPE DETECTION =====
  const PAGE_TYPE_MAP = {
    'docs.google.com': 'docs',
    'notion.so': 'docs',
    'notion.site': 'docs',
    'confluence': 'docs',
    'overleaf.com': 'docs',
    'medium.com': 'docs',
    'substack.com': 'docs',
    'dev.to': 'docs',
    'twitter.com': 'social',
    'x.com': 'social',
    'facebook.com': 'social',
    'instagram.com': 'social',
    'linkedin.com': 'social',
    'reddit.com': 'social',
    'mastodon': 'social',
    'threads.net': 'social',
    'github.com': 'code',
    'gitlab.com': 'code',
    'bitbucket.org': 'code',
    'stackoverflow.com': 'code',
    'codepen.io': 'code',
    'replit.com': 'code',
    'codesandbox.io': 'code',
    'vscode.dev': 'code',
    'mail.google.com': 'email',
    'outlook.live.com': 'email',
    'outlook.office.com': 'email',
    'protonmail.com': 'email',
    'mail.yahoo.com': 'email',
    'youtube.com': 'video',
    'vimeo.com': 'video',
    'twitch.tv': 'video',
    'netflix.com': 'video',
    'chatgpt.com': 'ai',
    'claude.ai': 'ai',
    'gemini.google.com': 'ai',
    'perplexity.ai': 'ai',
    'amazon.com': 'shopping',
    'ebay.com': 'shopping',
    'etsy.com': 'shopping',
  };

  function detectPageType() {
    for (const [domain, type] of Object.entries(PAGE_TYPE_MAP)) {
      if (currentDomain.includes(domain)) return type;
    }
    return 'general';
  }

  // ===== CONTENT EXTRACTION =====
  function extractPageContent() {
    const result = {
      title: document.title || '',
      description: '',
      keywords: [],
      text: '',
      url: window.location.href,
      domain: currentDomain,
      pageType: detectPageType(),
      selectedText: '',
      timestamp: Date.now(),
    };

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]')
      || document.querySelector('meta[property="og:description"]');
    if (metaDesc) {
      result.description = metaDesc.getAttribute('content') || '';
    }

    // Meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      result.keywords = metaKeywords
        .getAttribute('content')
        ?.split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0) || [];
    }

    // Open Graph title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && !result.title) {
      result.title = ogTitle.getAttribute('content') || '';
    }

    // Open Graph type
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType) {
      result.ogType = ogType.getAttribute('content') || '';
    }

    // Extract main text content (clean approach)
    const mainContent = extractMainText();
    result.text = mainContent;

    // Extract headings as keywords
    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach(h => {
      const text = h.textContent?.trim();
      if (text && text.length > 2 && text.length < 100 && result.keywords.length < 20) {
        result.keywords.push(text);
      }
    });

    pageContent = result;
    return result;
  }

  function extractMainText() {
    // Try to find the main content area
    const mainSelectors = [
      'main',
      'article',
      '[role="main"]',
      '[role="article"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content-body',
      '.markdown-body',
      '#content',
      '.prose',
      '.main-content',
      '.rich-text',
      '.ql-editor',
      '.notion-page-content',
      '.docs-content',
      '.gh-content',
    ];

    let targetElement = null;

    for (const selector of mainSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 100) {
        targetElement = el;
        break;
      }
    }

    // Fallback to body
    if (!targetElement) {
      targetElement = document.body;
    }

    if (!targetElement) return '';

    // Clone to avoid modifying the page
    const clone = targetElement.cloneNode(true);

    // Remove unwanted elements
    const removeSelectors = [
      'script', 'style', 'noscript', 'iframe', 'svg',
      'nav', 'footer', 'header',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.ad', '.ads', '.advertisement',
      '.sidebar', '.widget',
      '.comment', '.comments',
      '.related-posts',
      '.cookie-banner',
      '.modal', '.popup',
      'button', 'input', 'textarea', 'select',
    ];

    removeSelectors.forEach(selector => {
      try {
        clone.querySelectorAll(selector).forEach(el => el.remove());
      } catch (e) { /* ignore invalid selectors */ }
    });

    // Get text content
    const text = clone.textContent || '';
    const cleaned = text
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    return cleaned.substring(0, 15000); // Cap at 15k chars
  }

  // ===== TEXT SELECTION TRACKING =====
  function handleTextSelection() {
    const selection = window.getSelection();
    const text = selection?.toString()?.trim();

    if (!text || text.length < 5) return;

    // Debounce
    if (selectionTimeout) clearTimeout(selectionTimeout);

    selectionTimeout = setTimeout(() => {
      const finalText = text.substring(0, 5000);

      // Send to background
      try {
        chrome.runtime.sendMessage({
          type: 'TEXT_SELECTED',
          selectedText: finalText,
          url: window.location.href,
          title: document.title,
          domain: currentDomain,
        });
      } catch (e) {
        // Extension context may be invalidated
      }

      // Show save button near selection if enough text
      if (finalText.length > 20) {
        showSelectionTooltip(finalText);
      }
    }, 800);
  }

  // ===== SELECTION TOOLTIP =====
  function showSelectionTooltip(text) {
    // Remove existing tooltip
    removeSelectionTooltip();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const tooltip = document.createElement('div');
    tooltip.id = 'memora-selection-tooltip';
    tooltip.innerHTML = `
      <style>
        #memora-selection-tooltip {
          position: fixed;
          z-index: 2147483647;
          background: rgba(15, 15, 20, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 6px 12px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
          transition: opacity 0.2s, transform 0.2s;
          animation: memora-fade-in 0.2s ease;
        }
        #memora-selection-tooltip:hover {
          background: rgba(15, 15, 20, 0.98);
          border-color: rgba(16, 185, 129, 0.4);
          transform: translateY(-1px);
        }
        #memora-selection-tooltip .memora-icon {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          background: linear-gradient(135deg, #10b981, #06b6d4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
        }
        @keyframes memora-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
      <div class="memora-icon">M</div>
      <span>Save to Memora Bond</span>
    `;

    // Position above the selection
    const tooltipWidth = 140;
    const tooltipHeight = 34;
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    let top = rect.top - tooltipHeight - 8;

    // Keep in viewport
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tooltipWidth - 8;
    }
    if (top < 8) {
      top = rect.bottom + 8; // Place below if no room above
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Click handler to save
    tooltip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        chrome.runtime.sendMessage({
          type: 'SAVE_MEMORY',
          data: {
            text: text,
            title: `Selection from ${document.title || currentDomain}`,
            url: window.location.href,
            domain: currentDomain,
            type: 'clip',
            source: 'selection',
            tags: ['selection', detectPageType()],
          },
        });
      } catch (err) { /* ignore */ }

      removeSelectionTooltip();
      showSavedConfirmation();
    });

    document.body.appendChild(tooltip);

    // Auto-remove after 5 seconds or when selection changes
    setTimeout(() => removeSelectionTooltip(), 5000);
  }

  function removeSelectionTooltip() {
    const existing = document.getElementById('memora-selection-tooltip');
    if (existing) existing.remove();
  }

  function showSavedConfirmation() {
    const confirmation = document.createElement('div');
    confirmation.id = 'memora-save-confirmation';
    confirmation.innerHTML = `
      <style>
        #memora-save-confirmation {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          background: rgba(16, 185, 129, 0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 10px;
          padding: 12px 20px;
          color: #6ee7b7;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          animation: memora-slide-in 0.3s ease, memora-fade-out 0.3s ease 2.5s forwards;
        }
        @keyframes memora-slide-in {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes memora-fade-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(8px); }
        }
      </style>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <span>Saved ✓</span>
    `;

    document.body.appendChild(confirmation);
    setTimeout(() => {
      const el = document.getElementById('memora-save-confirmation');
      if (el) el.remove();
    }, 3000);
  }

  // ===== FLOATING MEMORA BOND BUTTON =====
  function createFloatingButton() {
    if (document.getElementById('memora-float-btn')) return;

    const button = document.createElement('div');
    button.id = 'memora-float-btn';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Save current page to Memora Bond');
    button.setAttribute('tabindex', '0');
    button.innerHTML = `
      <style>
        #memora-float-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483640;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(15, 15, 20, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 0 rgba(16, 185, 129, 0);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: memora-btn-appear 0.5s ease 1s both;
          user-select: none;
          -webkit-user-select: none;
        }
        #memora-float-btn:hover {
          background: rgba(15, 15, 20, 0.95);
          border-color: rgba(16, 185, 129, 0.4);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 3px rgba(16, 185, 129, 0.15);
          transform: scale(1.05);
        }
        #memora-float-btn:active {
          transform: scale(0.95);
        }
        #memora-float-btn:focus-visible {
          outline: 2px solid #10b981;
          outline-offset: 2px;
        }
        #memora-float-btn.memora-saved {
          border-color: rgba(16, 185, 129, 0.6);
          box-shadow: 0 4px 24px rgba(16, 185, 129, 0.2);
        }
        #memora-float-btn .memora-btn-icon {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.5px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        @keyframes memora-btn-appear {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      </style>
      <div class="memora-btn-icon">M</div>
    `;

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Extract current content
      const content = extractPageContent();

      // Save to background
      try {
        await chrome.runtime.sendMessage({
          type: 'SAVE_MEMORY',
          data: {
            text: `Page: ${content.title}\n\n${content.description || content.text?.substring(0, 2000)}`,
            title: content.title || document.title,
            url: window.location.href,
            domain: currentDomain,
            type: 'page',
            source: 'floating_button',
            tags: ['manual', content.pageType],
          },
        });

        // Visual feedback
        button.classList.add('memora-saved');
        showSavedConfirmation();

        setTimeout(() => button.classList.remove('memora-saved'), 3000);
      } catch (err) {
        console.error('[Memora Bond] Failed to save:', err);
      }
    });

    // Keyboard support
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });

    document.body.appendChild(button);
    memoraButton = button;
  }

  // ===== SPA NAVIGATION DETECTION =====
  function setupNavigationObserver() {
    // Monitor URL changes for SPA navigation
    let urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        handlePageNavigation();
      }
    }, 2000);

    // MutationObserver for title changes
    const titleObserver = new MutationObserver(() => {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        notifyBackgroundOfChange();
      }
    });

    titleObserver.observe(document.querySelector('title') || document.documentElement, {
      subtree: true,
      characterData: true,
      childList: true,
    });

    // History API interception for pushState / replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      originalPushState.apply(this, arguments);
      setTimeout(() => handlePageNavigation(), 100);
    };

    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      setTimeout(() => handlePageNavigation(), 100);
    };

    window.addEventListener('popstate', () => {
      setTimeout(() => handlePageNavigation(), 100);
    });
  }

  function handlePageNavigation() {
    const newUrl = window.location.href;
    if (newUrl === lastUrl) return;

    lastUrl = newUrl;
    lastTitle = document.title;

    // Re-check if the new URL is sensitive
    const isNewSensitive = SENSITIVE_PATTERNS.some(p => p.test(newUrl));
    if (isNewSensitive) {
      if (memoraButton) {
        memoraButton.remove();
        memoraButton = null;
      }
      return;
    }

    // Remove existing button and recreate after a delay
    if (memoraButton) {
      memoraButton.remove();
      memoraButton = null;
    }

    // Wait for page content to load
    setTimeout(() => {
      createFloatingButton();
      notifyBackgroundOfChange();
    }, 1500);
  }

  function notifyBackgroundOfChange() {
    const content = extractPageContent();

    try {
      chrome.runtime.sendMessage({
        type: 'CONTENT_EXTRACTED',
        content,
        metadata: {
          url: window.location.href,
          title: document.title,
          domain: currentDomain,
          pageType: detectPageType(),
        },
      });
    } catch (e) {
      // Extension context may be invalidated
    }
  }

  // ===== MESSAGE LISTENER (from background) =====
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_CONTENT') {
      const content = extractPageContent();
      sendResponse({ success: true, content });
      return true;
    }

    if (message.type === 'GET_PAGE_INFO') {
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: document.title,
          domain: currentDomain,
          pageType: detectPageType(),
          selection: window.getSelection()?.toString()?.trim() || '',
        },
      });
      return true;
    }

    return false;
  });

  // ===== INITIALIZATION =====
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // Extract initial content
    extractPageContent();

    // Create floating button
    setTimeout(() => createFloatingButton(), 1500);

    // Setup navigation observer
    setupNavigationObserver();

    // Listen for text selection
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        removeSelectionTooltip();
      }
    });

    // Also handle touch events for mobile
    document.addEventListener('touchend', () => {
      setTimeout(handleTextSelection, 300);
    });

    console.log(`[Memora Bond] Content script active on ${currentDomain}`);
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }

})();
