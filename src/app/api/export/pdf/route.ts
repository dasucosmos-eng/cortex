import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { adminDb } from '@/lib/firebase'

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { startDate, endDate, type } = await req.json()

    // Fetch data based on type
    let data: any[] = []
    let title = 'Memora Bond Data Export'

    if (type === 'memories' || !type) {
      const snapshot = await adminDb.collection('memories')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(500)
        .get()
      data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      title = 'Memora Bond — Memories Export'
    } else if (type === 'timeline') {
      let query = adminDb.collection('timeline')
        .where('userId', '==', user.uid)
        .orderBy('timestamp', 'desc')
        .limit(500)
      if (startDate) query = query.where('timestamp', '>=', new Date(startDate).toISOString()) as any
      if (endDate) query = query.where('timestamp', '<=', new Date(endDate).toISOString()) as any
      const snapshot = await query.get()
      data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      title = 'Memora Bond — Timeline Export'
    } else if (type === 'sessions') {
      const snapshot = await adminDb.collection('sessions')
        .where('userId', '==', user.uid)
        .orderBy('startedAt', 'desc')
        .limit(200)
        .get()
      data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      title = 'Memora Bond — Sessions Export'
    } else if (type === 'all') {
      // Export everything as a comprehensive report
      const [memSnap, sesSnap, tlSnap] = await Promise.all([
        adminDb.collection('memories').where('userId', '==', user.uid).orderBy('createdAt', 'desc').limit(200).get(),
        adminDb.collection('sessions').where('userId', '==', user.uid).orderBy('startedAt', 'desc').limit(50).get(),
        adminDb.collection('timeline').where('userId', '==', user.uid).orderBy('timestamp', 'desc').limit(200).get(),
      ])
      title = 'Memora Bond — Complete Data Export'
    }

    // Return data as JSON for client-side PDF generation
    return NextResponse.json({
      title,
      exportDate: new Date().toISOString(),
      userName: user.name || user.email,
      count: data.length,
      type,
      data,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
