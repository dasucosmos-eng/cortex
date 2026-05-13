import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore } from 'firebase-admin/firestore'
import { getAuth, Auth } from 'firebase-admin/auth'
import { getStorage, Storage } from 'firebase-admin/storage'

let _app: App | null = null
let _db: Firestore | null = null
let _auth: Auth | null = null
let _storage: Storage | null = null

function initApp(): App {
  if (_app) return _app
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || ''
  const serviceAccount = key ? JSON.parse(
    Buffer.from(key, 'base64').toString('utf-8')
  ) : {}
  _app = getApps().length === 0 ? initializeApp({
    credential: cert(serviceAccount as any),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  }) : getApp()
  return _app
}

// Lazy Firestore instance using a Proxy so Firebase initializes only at runtime,
// not during Next.js build's static analysis / page data collection phase.
const dbHolder: { current: Firestore | null } = { current: null }

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!dbHolder.current) {
      dbHolder.current = getFirestore(initApp())
    }
    const value = (dbHolder.current as any)[prop]
    if (typeof value === 'function') return value.bind(dbHolder.current)
    return value
  },
  has(_, prop) {
    if (!dbHolder.current) {
      dbHolder.current = getFirestore(initApp())
    }
    return prop in (dbHolder.current as any)
  },
})

const authHolder: { current: Auth | null } = { current: null }

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!authHolder.current) {
      authHolder.current = getAuth(initApp())
    }
    const value = (authHolder.current as any)[prop]
    if (typeof value === 'function') return value.bind(authHolder.current)
    return value
  },
  has(_, prop) {
    if (!authHolder.current) {
      authHolder.current = getAuth(initApp())
    }
    return prop in (authHolder.current as any)
  },
})

const storageHolder: { current: Storage | null } = { current: null }

export const adminStorage: Storage = new Proxy({} as Storage, {
  get(_, prop) {
    if (!storageHolder.current) {
      storageHolder.current = getStorage(initApp())
    }
    const value = (storageHolder.current as any)[prop]
    if (typeof value === 'function') return value.bind(storageHolder.current)
    return value
  },
  has(_, prop) {
    if (!storageHolder.current) {
      storageHolder.current = getStorage(initApp())
    }
    return prop in (storageHolder.current as any)
  },
})

// Client-side config (exported as a function to prevent server-side leaks)
export function getClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
}
