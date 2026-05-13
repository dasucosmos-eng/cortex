import { adminDb } from './firebase'
import { FieldValue, Timestamp, CollectionReference, Query } from 'firebase-admin/firestore'

// Helper to get a typed collection reference
export function getCollection<T>(name: string): CollectionReference {
  return adminDb.collection(name) as CollectionReference<T>
}

// Helper to generate a new document ID
export function generateId(): string {
  return adminDb.collection('_').doc().id
}

// Server timestamp
export const serverTimestamp = FieldValue.serverTimestamp()
export const firestoreTimestamp = Timestamp

// Convenience collections
export const collections = {
  users: () => adminDb.collection('users'),
  memories: () => adminDb.collection('memories'),
  sessions: () => adminDb.collection('sessions'),
  timeline: () => adminDb.collection('timeline'),
  projects: () => adminDb.collection('projects'),
  knowledgeNodes: () => adminDb.collection('knowledgeNodes'),
  knowledgeEdges: () => adminDb.collection('knowledgeEdges'),
  vault: () => adminDb.collection('vault'),
  syncState: () => adminDb.collection('syncState'),
  subscriptions: () => adminDb.collection('subscriptions'),
  fingerprints: () => adminDb.collection('fingerprints'),
}
