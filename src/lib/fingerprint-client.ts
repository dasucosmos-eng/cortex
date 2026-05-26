// ============================================================
// Browser Fingerprint — Client-Side Only
// ============================================================
// Generates a stable browser fingerprint hash using canvas,
// WebGL, screen, and navigator properties.
//
// This file is SAFE to import in client components.
// Server-side fingerprint operations are in fingerprint-server.ts
// ============================================================

/**
 * Generate a stable browser fingerprint hash.
 * Uses canvas rendering, WebGL renderer info, screen dimensions,
 * timezone, language, platform, and hardware concurrency.
 *
 * Returns a string like "fp_<hash>_<length>" that is consistent
 * for the same browser/device configuration.
 */
export async function generateBrowserFingerprint(): Promise<string> {
  const components: string[] = []

  // Canvas fingerprint — draws text/shapes; output varies by GPU, font engine, etc.
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 280
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '16px "Arial"'
      ctx.fillStyle = '#e8491d'
      ctx.fillRect(140, 2, 62, 20)
      ctx.fillStyle = '#1a73e8'
      ctx.fillText('Memora-fp', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('Memora-fp', 4, 17)
      ctx.beginPath()
      ctx.arc(250, 30, 15, 0, Math.PI * 2)
      ctx.fillStyle = '#ff6600'
      ctx.fill()
      ctx.strokeStyle = '#003366'
      ctx.lineWidth = 2
      ctx.stroke()
      components.push(canvas.toDataURL())
    }
  } catch {
    // Canvas blocked — continue with other signals
  }

  // WebGL renderer & vendor info — highly unique per device/GPU
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        components.push(
          (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string,
        )
        components.push(
          (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string,
        )
      }
      const extensions = (gl as WebGLRenderingContext).getSupportedExtensions()
      if (extensions) {
        components.push(extensions.join(','))
      }
    }
  } catch {
    // WebGL blocked — continue
  }

  // Screen properties
  if (typeof screen !== 'undefined') {
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`)
    components.push(`${screen.pixelDepth}`)
    components.push(`${screen.availWidth}x${screen.availHeight}`)
  }

  // Timezone
  try {
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {}

  // Language & languages list
  components.push(navigator.language)
  if (navigator.languages) {
    components.push(navigator.languages.join(','))
  }

  // Platform & hardware
  components.push(navigator.platform || '')
  components.push(`${navigator.hardwareConcurrency || 0}`)

  // Device memory (if available — Chrome only)
  try {
    const nav = navigator as any
    if (nav.deviceMemory) components.push(`${nav.deviceMemory}`)
  } catch {}

  // Max touch points (distinguishes touch vs non-touch devices)
  components.push(`${navigator.maxTouchPoints || 0}`)

  // User agent string
  components.push(navigator.userAgent)

  // ---------- Hashing (FNV-1a-inspired + base36) ----------
  const str = components.join('|||')
  let hash1 = 0x811c9dc5
  let hash2 = 0xcbf29ce4

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash1 ^= char
    hash1 = Math.imul(hash1, 0x01000193)
    hash2 ^= char
    hash2 = Math.imul(hash2, 0x01000193)
  }

  const combined = ((hash1 >>> 0) * 4096 + (hash2 >>> 0)).toString(36)
  return `fp_${combined}_${str.length.toString(36)}`
}
