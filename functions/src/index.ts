// Memora Bond — Firebase Cloud Functions
// Auth + PayPal + Dashboard API endpoints
// Replaces Next.js API routes for Firebase Functions deployment

import { https } from 'firebase-functions/v2';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import ZAI from 'z-ai-web-dev-sdk';

setGlobalOptions({ region: 'us-central1', minInstances: 0 });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const adminAuth = admin.auth();
const adminDb = admin.firestore();

// ============================
// Environment
// ============================
const PAYPAL_BASE_URL = 'https://api-m.paypal.com';
const PAYPAL_PLAN_ID = 'P-37427108SE2105812NICVVPY';
const APP_URL = 'https://memora.bond';

// PayPal credentials — stored in Firestore config, cached in memory
let cachedPayPalCreds: { clientId: string; secret: string } | null = null;
async function getPayPalCredentials(): Promise<{ clientId: string; secret: string } | null> {
  if (cachedPayPalCreds) return cachedPayPalCreds;
  try {
    const doc = await adminDb.collection('_config').doc('paypal').get();
    if (doc.exists) {
      const d = doc.data()!;
      cachedPayPalCreds = { clientId: d.client_id || '', secret: d.client_secret || '' };
      return cachedPayPalCreds;
    }
  } catch { /* ignore */ }
  return null;
}

// ============================
// CORS Helper
// ============================
function corsHeaders(origin?: string) {
  const allowed = ['https://memora-bond.web.app', 'https://memora.bond', 'http://localhost:3000'];
  const o = allowed.includes(origin || '') ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

// Helper: extract & verify Bearer token → returns uid
async function verifyUser(req: any): Promise<string | null> {
  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// Helper: CORS preflight handler
function handleCors(req: any, res: any): boolean {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders(req.headers?.origin || req.header?.('origin')));
    res.status(204).send('');
    return true;
  }
  return false;
}

// ============================
// POST /api/auth/google
// ============================
export const apiAuthGoogle = https.onRequest(
  async (req: any, res: any) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const { idToken } = req.body;
      if (!idToken) return res.status(400).json({ error: 'No token provided' });

      const decoded = await adminAuth.verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = decoded.email || '';
      const name = decoded.name || 'User';
      const picture = decoded.picture || '';

      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        await userRef.set({
          uid, email, name, picture,
          createdAt: new Date().toISOString(),
          trialStart: new Date().toISOString(),
          subscriptionStatus: 'trialing',
          storageUsed: 0,
          browserFingerprint: null,
          lastLoginAt: new Date().toISOString(),
          role: 'user',
        });

        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 2);
        await adminDb.collection('subscriptions').doc(uid).set({
          userId: uid, plan: 'trial', status: 'active',
          trialStart: new Date().toISOString(),
          trialEnd: trialEnd.toISOString(),
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: trialEnd.toISOString(),
          paypalSubscriptionId: null,
          createdAt: new Date().toISOString(),
        });
      } else {
        await userRef.update({
          lastLoginAt: new Date().toISOString(),
          name: name !== 'User' ? name : userDoc.data()?.name,
          picture: picture || userDoc.data()?.picture,
        });
      }

      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({ success: true, uid, email, name, picture });
    } catch (error: any) {
      console.error('Google auth error:', error);
      return res.status(401).json({ error: error.message || 'Authentication failed' });
    }
  }
);

// ============================
// GET /api/auth/session
// ============================
export const apiAuthSession = https.onRequest(
  async (req: any, res: any) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const uid = await verifyUser(req);
      if (!uid) return res.status(401).json({ error: 'No token' });

      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
      const userData = userDoc.data();

      const subDoc = await adminDb.collection('subscriptions').doc(uid).get();
      const subData = subDoc.exists ? subDoc.data() : null;

      const now = new Date();
      let trialExpired = false;
      let isLocked = false;

      if (subData && subData.status === 'active' && subData.plan === 'trial') {
        if (new Date(subData.trialEnd) < now) {
          trialExpired = true;
          await adminDb.collection('subscriptions').doc(uid).update({ status: 'expired' });
          await adminDb.collection('users').doc(uid).update({ subscriptionStatus: 'expired' });
          isLocked = true;
        }
      }
      if (subData && subData.status === 'expired') isLocked = true;

      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({
        user: { uid, email: userData?.email, name: userData?.name, picture: userData?.picture, subscriptionStatus: userData?.subscriptionStatus, storageUsed: userData?.storageUsed || 0 },
        subscription: subData ? { plan: subData.plan, status: subData.status, trialEnd: subData.trialEnd, currentPeriodEnd: subData.currentPeriodEnd, trialExpired, isLocked } : null,
      });
    } catch (error: any) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
);

// ============================
// /api/auth/fingerprint
// ============================
export const apiAuthFingerprint = https.onRequest(
  async (req: any, res: any) => {
    if (handleCors(req, res)) return;

    try {
      if (req.method === 'GET') {
        const fingerprint = req.query.fingerprint as string;
        if (!fingerprint) return res.status(400).json({ error: 'Fingerprint required' });
        const existing = await adminDb.collection('users').where('browserFingerprint', '==', fingerprint).limit(1).get();
        return res.status(200).json({ eligible: existing.empty, reason: existing.empty ? null : 'Browser already registered' });
      }

      if (req.method === 'POST') {
        const uid = await verifyUser(req);
        if (!uid) return res.status(401).json({ error: 'Unauthorized' });
        const { fingerprint } = req.body;
        if (!fingerprint) return res.status(400).json({ error: 'Fingerprint required' });
        const existing = await adminDb.collection('users').where('browserFingerprint', '==', fingerprint).limit(1).get();
        if (!existing.empty && existing.docs[0].id !== uid) {
          return res.status(403).json({ eligible: false, reason: 'Browser already registered', code: 'FINGERPRINT_BLOCKED' });
        }
        await adminDb.collection('users').doc(uid).update({ browserFingerprint: fingerprint });
        return res.status(200).json({ success: true, eligible: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// ============================
// GET /api/paypal/subscription-status
// Returns subscription plan, trial status, days remaining
// ============================
export const apiPaypalSubscriptionStatus = https.onRequest(
  async (req: any, res: any) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const uid = await verifyUser(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const subDoc = await adminDb.collection('subscriptions').doc(uid).get();
      if (!subDoc.exists) return res.status(404).json({ error: 'No subscription' });

      const subData = subDoc.data()!;
      const now = new Date();

      let status = subData.status || 'active';
      if (subData.plan === 'trial' && new Date(subData.trialEnd) < now) {
        status = 'expired';
        await adminDb.collection('subscriptions').doc(uid).update({ status: 'expired' });
        await adminDb.collection('users').doc(uid).update({ subscriptionStatus: 'expired' });
      }

      const isActive = status === 'active';
      const isLocked = status === 'expired';
      const isTrial = subData.plan === 'trial';
      const trialEnd = subData.trialEnd ? new Date(subData.trialEnd) : null;
      const daysRemaining = isTrial && trialEnd
        ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({
        plan: subData.plan,
        status,
        isActive,
        isLocked,
        isTrial,
        trialEnd: subData.trialEnd,
        currentPeriodEnd: subData.currentPeriodEnd,
        daysRemaining,
        paypalSubscriptionId: subData.paypalSubscriptionId,
        price: subData.plan === 'pro' ? '$12/month' : 'Free trial',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// ============================
// POST /api/paypal/create-subscription
// Creates a PayPal subscription and returns approval URL
// ============================
export const apiPaypalCreateSubscription = https.onRequest(
  async (req: any, res: any) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const uid = await verifyUser(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const accessToken = await getPayPalAccessToken();
      if (!accessToken) return res.status(503).json({ error: 'PayPal unavailable' });

      const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          plan_id: PAYPAL_PLAN_ID,
          application_context: {
            brand_name: 'Memora Bond',
            locale: 'en-US',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            return_url: `${APP_URL}/api/paypal/return?uid=${uid}`,
            cancel_url: `${APP_URL}/settings?cancelled=true`,
          },
          custom_id: uid,
        }),
      });

      const ppData: any = await response.json();
      if (!response.ok) {
        console.error('PayPal subscription error:', ppData);
        return res.status(500).json({ error: 'Failed to create subscription', details: ppData });
      }

      const approveLink = (ppData.links || []).find((link: any) => link.rel === 'approve');
      if (!approveLink?.href) return res.status(500).json({ error: 'No approval URL' });

      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({ subscriptionId: ppData.id, approveUrl: approveLink.href });
    } catch (error: any) {
      console.error('PayPal error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

// ============================
// POST /api/paypal/webhook
// Handles PayPal subscription events
// ============================
export const apiPaypalWebhook = https.onRequest(
  async (req: any, res: any) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const event: any = req.body;
      const eventType = event.event_type;
      console.log(`PayPal webhook: ${eventType}`, event.id);

      const userId = event.resource?.custom_id;
      if (!userId) return res.status(200).json({ received: true });

      switch (eventType) {
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
        case 'BILLING.SUBSCRIPTION.RE_ACTIVATED': {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await adminDb.collection('subscriptions').doc(userId).set({
            userId, plan: 'pro', status: 'active',
            paypalSubscriptionId: event.resource?.id,
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
            trialStart: null, trialEnd: null,
            createdAt: now.toISOString(),
          }, { merge: true });
          await adminDb.collection('users').doc(userId).update({ subscriptionStatus: 'active' });
          break;
        }
        case 'BILLING.SUBSCRIPTION.CANCELLED':
        case 'BILLING.SUBSCRIPTION.EXPIRED':
        case 'BILLING.SUBSCRIPTION.SUSPENDED':
          await adminDb.collection('subscriptions').doc(userId).update({ status: 'expired' });
          await adminDb.collection('users').doc(userId).update({ subscriptionStatus: 'expired' });
          break;
        case 'PAYMENT.SALE.COMPLETED': {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await adminDb.collection('subscriptions').doc(userId).update({
            status: 'active', plan: 'pro',
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: periodEnd.toISOString(),
          });
          await adminDb.collection('users').doc(userId).update({ subscriptionStatus: 'active' });
          break;
        }
      }

      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({ received: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// ============================
// GET /api/paypal/return
// PayPal redirect after approval
// ============================
export const apiPaypalReturn = https.onRequest(
  async (req: any, res: any) => {
    const uid = req.query.uid;
    const token = req.query.token;
    console.log(`PayPal return: uid=${uid}, token=${token}`);

    if (uid && token) {
      // Subscription will be activated via webhook, just redirect
      res.redirect(302, `${APP_URL}/settings?subscribed=true`);
    } else {
      res.redirect(302, `${APP_URL}/settings`);
    }
  }
);

// ============================
// POST /api/paypal/cancel
// ============================
export const apiPaypalCancel = https.onRequest(
  async (req: any, res: any) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const uid = await verifyUser(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const subDoc = await adminDb.collection('subscriptions').doc(uid).get();
      const paypalSubId = subDoc.exists ? subDoc.data()?.paypalSubscriptionId : null;

      if (paypalSubId) {
        const accessToken = await getPayPalAccessToken();
        if (accessToken) {
          try {
            await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${paypalSubId}/cancel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            });
          } catch { /* ignore cancel API errors */ }
        }
      }

      await adminDb.collection('subscriptions').doc(uid).update({ status: 'cancelled' });
      await adminDb.collection('users').doc(uid).update({ subscriptionStatus: 'cancelled' });

      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// ============================
// POST /api/auth/extension-token
// Validates a Firebase ID token from the extension, creates/updates user, returns server info
// ============================
export const apiAuthExtensionToken = https.onRequest(
  async (req: any, res: any) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const { idToken } = req.body;
      if (!idToken) return res.status(400).json({ error: 'No token provided' });

      const decoded = await adminAuth.verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = decoded.email || '';
      const name = decoded.name || 'User';
      const picture = decoded.picture || '';

      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        await userRef.set({
          uid, email, name, picture,
          createdAt: new Date().toISOString(),
          trialStart: new Date().toISOString(),
          subscriptionStatus: 'trialing',
          storageUsed: 0, browserFingerprint: null,
          lastLoginAt: new Date().toISOString(),
          role: 'user',
        });

        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 2);
        await adminDb.collection('subscriptions').doc(uid).set({
          userId: uid, plan: 'trial', status: 'active',
          trialStart: new Date().toISOString(),
          trialEnd: trialEnd.toISOString(),
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: trialEnd.toISOString(),
          paypalSubscriptionId: null,
          createdAt: new Date().toISOString(),
        });
      } else {
        await userRef.update({
          lastLoginAt: new Date().toISOString(),
          name: name !== 'User' ? name : userDoc.data()?.name,
          picture: picture || userDoc.data()?.picture,
        });
      }

      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({ success: true, uid, email, name, picture, serverUrl: APP_URL });
    } catch (error: any) {
      console.error('Extension auth error:', error);
      return res.status(401).json({ error: error.message || 'Authentication failed' });
    }
  }
);

// ============================
// Dashboard data endpoints
// ============================

// Generic empty-data handler for dashboard endpoints
function emptyDataResponse(req: any, res: any, data: any) {
  res.set(corsHeaders(req.headers?.origin));
  return res.status(200).json({ data });
}

// GET /api/memories
export const apiMemories = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const snap = await adminDb.collection('users').doc(uid).collection('memories').orderBy('createdAt', 'desc').limit(50).get();
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  emptyDataResponse(req, res, data);
});

// GET /api/sessions
export const apiSessions = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const snap = await adminDb.collection('users').doc(uid).collection('sessions').orderBy('startTime', 'desc').limit(20).get();
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  emptyDataResponse(req, res, data);
});

// GET /api/timeline
export const apiTimeline = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const snap = await adminDb.collection('users').doc(uid).collection('timelines').orderBy('timestamp', 'desc').limit(50).get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    emptyDataResponse(req, res, data);
  } catch { emptyDataResponse(req, res, []); }
});

// GET /api/projects
export const apiProjects = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const snap = await adminDb.collection('users').doc(uid).collection('projects').limit(20).get();
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  emptyDataResponse(req, res, data);
});

// GET /api/context-capsule
export const apiContextCapsule = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    // Get active sessions
    const sessSnap = await adminDb.collection('users').doc(uid).collection('sessions')
      .where('status', '==', 'active').limit(1).get();
    const activeSession = sessSnap.docs[0]?.data() || null;

    // Get today's timeline
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tlSnap = await adminDb.collection('users').doc(uid).collection('timelines')
      .where('timestamp', '>=', todayStart.toISOString()).orderBy('timestamp', 'desc').limit(20).get();
    const todaysTimeline = tlSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Get recent memories
    const memSnap = await adminDb.collection('users').doc(uid).collection('memories')
      .orderBy('createdAt', 'desc').limit(5).get();
    const recentMemories = memSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const data = {
      currentSession: activeSession ? {
        id: activeSession.id,
        title: activeSession.title,
        task: activeSession.task || null,
        intent: activeSession.intent || null,
        project: activeSession.domains?.[0] || null,
        startedAt: activeSession.startTime || activeSession.startedAt,
        memoryCount: activeSession.pageViews || 0,
      } : null,
      todaysTimeline,
      summary: {
        activeSessionTitle: activeSession?.title || null,
        projectName: activeSession?.domains?.[0] || null,
        recentMemoryCount: recentMemories.length,
        todayEventCount: todaysTimeline.length,
        hasSensitiveData: false,
      },
    };
    emptyDataResponse(req, res, data);
  } catch { emptyDataResponse(req, res, { currentSession: null }); }
});

// GET /api/knowledge-graph
export const apiKnowledgeGraph = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const memSnap = await adminDb.collection('users').doc(uid).collection('memories').limit(200).get();
    const memories = memSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const nodeMap = new Map<string, { id: string; type: string; label: string }>();
    const edges: Array<{ fromId: string; toId: string; type: string; strength: number }> = [];
    const edgeSet = new Set<string>();

    for (const mem of memories) {
      // Add memory node
      const nodeId = mem.id;
      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, { id: nodeId, type: 'memory', label: mem.title || 'Untitled' });
      }
      // Add domain node
      if (mem.domain) {
        if (!nodeMap.has(mem.domain)) {
          nodeMap.set(mem.domain, { id: mem.domain, type: 'domain', label: mem.domain });
        }
        const edgeKey = `${nodeId}->${mem.domain}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({ fromId: nodeId, toId: mem.domain, type: 'belongs_to', strength: 0.8 });
 }
      }
      // Add tags as nodes
      const tags: string[] = mem.tags || [];
      for (const tag of tags.slice(0, 5)) {
        const tagId = `tag_${tag}`;
        if (!nodeMap.has(tagId)) {
          nodeMap.set(tagId, { id: tagId, type: 'tag', label: tag });
        }
        const edgeKey2 = `${nodeId}->${tagId}`;
        if (!edgeSet.has(edgeKey2)) {
          edgeSet.add(edgeKey2);
          edges.push({ fromId: nodeId, toId: tagId, type: 'tagged_with', strength: 0.6 });
 }
      }
    }

    emptyDataResponse(req, res, {
      nodeCount: nodeMap.size,
      edgeCount: edges.length,
      nodes: Array.from(nodeMap.values()),
      edges,
    });
  } catch { emptyDataResponse(req, res, { nodes: [], edges: [] }); }
});

// GET /api/agents
export const apiAgents = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  emptyDataResponse(req, res, { agents: [] });
});

// GET /api/agents/executions
export const apiAgentExecutions = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  emptyDataResponse(req, res, []);
});

// GET /api/search
export const apiSearch = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const q = (req.query.q || '').toString().toLowerCase().trim();
    if (!q) return emptyDataResponse(req, res, { results: [], total: 0 });
    const terms = q.split(/\s+/).filter(t => t.length > 1);

    const memSnap = await adminDb.collection('users').doc(uid).collection('memories').limit(200).get();
    const memories = memSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const scored = memories.map((m: any) => {
      let score = 0;
      const fields = [
        (m.title || '').toLowerCase(),
        (m.content || m.textPreview || m.description || '').toLowerCase(),
        (m.domain || '').toLowerCase(),
        (m.url || '').toLowerCase(),
        (m.tags || []).join(' ').toLowerCase(),
      ];
      for (const term of terms) {
        for (const field of fields) {
          if (field.includes(term)) score += 5;
        }
      }
      return { memory: m, score };
    });

    const results = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map(item => ({
        id: item.memory.id,
        type: 'memory',
        title: item.memory.title || 'Untitled',
        content: (item.memory.content || item.memory.textPreview || item.memory.description || '').substring(0, 200),
        score: Math.min(item.score / 50, 1),
        createdAt: item.memory.createdAt || item.memory.syncedAt || '',
      }));

    emptyDataResponse(req, res, { results, total: results.length });
  } catch { emptyDataResponse(req, res, { results: [], total: 0 }); }
});

// GET /api/vault
export const apiVault = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const snap = await adminDb.collection('users').doc(uid).collection('vault').orderBy('createdAt', 'desc').limit(50).get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    emptyDataResponse(req, res, data);
  } catch { emptyDataResponse(req, res, []); }
});

// POST & PUT /api/sync
export const apiSync = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  const uid = await verifyUser(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Handle PUT from extension — store synced memories, sessions, timeline
    if (req.method === 'PUT') {
      const { changes, deviceId } = req.body || {};
      if (Array.isArray(changes)) {
        const batch = adminDb.batch();
        for (const change of changes) {
          if (!change.type || !change.data) continue;
          // Map type to correct Firestore collection name
          let collectionName: string;
          switch (change.type) {
            case 'memory': collectionName = 'memories'; break;
            case 'session': collectionName = 'sessions'; break;
            case 'timeline': collectionName = 'timelines'; break;
            default: collectionName = change.type + 's';
          }
          const docRef = adminDb.collection('users').doc(uid).collection(collectionName).doc();
          batch.set(docRef, {
            ...change.data,
            userId: uid,
            deviceId: deviceId || null,
            createdAt: change.data.createdAt || change.data.firstVisited || change.data.startTime || change.data.timestamp || new Date().toISOString(),
            syncedAt: new Date().toISOString(),
          });
        }
        if (changes.length > 0) await batch.commit();
      }
    }

    res.set(corsHeaders(req.headers?.origin));
    return res.status(200).json({ success: true, syncedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================
// PayPal Access Token Helper
// ============================
async function getPayPalAccessToken(): Promise<string | null> {
  try {
    const creds = await getPayPalCredentials();
    if (!creds || !creds.clientId || !creds.secret) return null;
    const auth = Buffer.from(`${creds.clientId}:${creds.secret}`).toString('base64');
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${auth}` },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    return data.access_token;
  } catch {
    return null;
  }
}

// ============================
// POST /api/ai/recall
// AI recall endpoint — retrieves relevant context using ZAI
// ============================
export const apiAiRecall = https.onRequest(async (req: any, res: any) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const uid = await verifyUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Search user's memories
    const memoriesSnap = await adminDb
      .collection('users').doc(uid).collection('memories')
      .orderBy('createdAt', 'desc').limit(50).get();

    const allMemories = memoriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const searchTerms = query.trim().split(/\s+/).map(t => t.toLowerCase());

    const relevantMemories = allMemories.filter((m: any) => {
      const text = [m.content, m.summary, m.title, m.tags]
        .filter(Boolean).join(' ').toLowerCase();
      return searchTerms.some(term => text.includes(term));
    }).slice(0, 10);

    const memoryContext = relevantMemories
      .map((m: any) => `[${m.type || 'page'}] ${m.title || 'Untitled'}: ${(m.summary || m.content || '').substring(0, 200)}`)
      .join('\n');

    try {
      const zai = await ZAI.create();

      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are Memora Bond's AI memory assistant. Based on the user's query and their browsing memories, provide a helpful response. Be concise and specific. If no relevant memories are found, say so honestly.`,
          },
          {
            role: 'user',
            content: `Query: ${query.trim()}\n\nMy browsing memories:\n${memoryContext || 'No memories found.'}`,
          },
        ],
      });

      const aiContent = completion.choices?.[0]?.message?.content || 'No response generated.';

      // Try to parse as JSON, otherwise return as text
      let parsed;
      try {
        const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : aiContent;
        parsed = JSON.parse(jsonStr.trim());
      } catch {
        parsed = {
          currentProject: null,
          currentTask: null,
          relevantMemories: relevantMemories.map((m: any) => ({
            id: m.id, type: m.type, summary: (m.summary || m.content || '').substring(0, 100),
          })),
          suggestedNextSteps: [],
          response: aiContent,
        };
      }

      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({ data: parsed });
    } catch (aiError: any) {
      console.error('AI recall error:', aiError);
      const errMsg = aiError?.message || 'Unknown AI error';
      res.set(corsHeaders(req.headers?.origin));
      return res.status(200).json({
        data: {
          currentProject: null,
          currentTask: null,
          relevantMemories: relevantMemories.map((m: any) => ({
            id: m.id, type: m.type, summary: (m.summary || m.content || '').substring(0, 100),
          })),
          suggestedNextSteps: [],
          response: `AI service encountered an error: ${errMsg}. Showing ${relevantMemories.length} matching memories above.`,
          error: true,
        },
      });
    }
  } catch (error: any) {
    console.error('AI recall error:', error);
    res.set(corsHeaders(req.headers?.origin));
    return res.status(500).json({ error: 'AI recall failed' });
  }
});
