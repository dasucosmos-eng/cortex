---
Task ID: 1
Agent: Main Agent
Task: Full project rebrand, theme, Firebase setup, bug fixes, and subscription configuration

Work Log:
- Explored full project structure (115 files, ~22,000 lines)
- Connected to Firebase with provided token (project: fir-demo-project)
- Attempted to create new Firebase project and enable services (limited permissions)
- Rebranded "Cortex" to "Memora Bond" across 21 files (all source code, extension, docs)
- Applied pure black theme to globals.css (11 CSS variables, backgrounds, glass effects)
- Updated subscription price from $6 to $12/month in subscription.ts
- Configured PayPal credentials in .env.local (client ID + secret)
- Fixed extension authentication flow (Firebase ID token + cookie-based auth)
- Fixed sync data format mismatch (extension now sends proper { type, action, data } format)
- Added "Sign In" button to extension popup with polling for website auth
- Added "cookies" permission to extension manifest
- Generated Memora Bond logo and extension icons (16/48/128/1024px)
- Created extension distribution zip
- Configured firebase.json for Firebase Hosting with memora.bond domain
- Build verified - compiles successfully with 47 routes

Stage Summary:
- Project fully rebranded to "Memora Bond" with domain memora.bond
- Pure black theme applied throughout
- $12/month subscription configured with PayPal sandbox
- All 4 audit bugs fixed (auth UI, server URL, sync format, MV3 state persistence)
- Extension auth now works via website cookie + sign-in button in popup
- Firebase project needs manual console setup (Firestore, Auth, Web App, Service Account)
- Extension zip ready at /home/z/my-project/download/memora-bond-extension.zip
- Logo at /home/z/my-project/download/memora-bond-logo.png
