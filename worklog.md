---
Task ID: 1
Agent: Main Agent
Task: Fix all critical bugs in Memora Bond extension and website

Work Log:
- Analyzed all project files: extension (background.js, popup/app.js, content/index.js), website (login page, firebase-client, page.tsx, next.config.ts, firebase.json, functions/src/index.ts)
- Identified ROOT CAUSE: _next/static/chunks/ was at wrong path (/_next/static/static/chunks/) — entire site JavaScript was broken
- Identified 5 critical bugs:
  1. next.config.ts had `output: "standalone"` instead of `output: "export"` — static hosting broken
  2. Login page had no email/password login, only Google sign-in
  3. Extension auth polling ran in popup.js which closes when login tab opens — auth sync never worked
  4. No AI Firebase Functions — AI endpoints only existed as Next.js API routes (not available with static hosting)
  5. Static chunks path mismatch (_next/static/static/chunks/ vs _next/static/chunks/)

Fixes Applied:
- Fixed next.config.ts: `output: "export"` + `images: { unoptimized: true }`
- Rewrote login page with Suspense boundary, email/password support, Google sign-in, and `?from=extension` handling
- Added `startAuthPolling()` to background.js service worker — polls for memora_token cookie every 2s for 5 minutes
- Fixed popup.js: removed broken `pollForAuth()`, now just sends SIGN_IN_WEBSITE message to background
- Added `apiAiRecall` Firebase Function with z-ai-web-dev-sdk integration and fallback
- Added `/api/ai/recall` rewrite to firebase.json
- Removed middleware.ts (not needed for static export)
- Moved API routes to /tmp (conflicted with static export — Firebase Functions handle all API)
- Rebuilt Next.js static export (7 pages), copied to public/
- Deployed hosting (118 files) and functions to Firebase
- Re-zipped extension (679KB) to download/

Stage Summary:
- Website deployed at https://memora.bond with working JavaScript, login page (Google + email/password), and AI endpoint
- Extension ZIP ready at /home/z/my-project/download/memora-bond-extension.zip with auth sync fix
- Key fix: Extension now polls for auth cookie in background service worker (not popup), so it survives the popup closing
