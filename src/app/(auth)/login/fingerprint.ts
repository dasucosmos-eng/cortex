export async function generateBrowserFingerprint(): Promise<string> {
  const components: string[] = []
  
  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('Memora-fp', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('Memora-fp', 4, 17)
      components.push(canvas.toDataURL())
    }
  } catch {}

  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string)
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string)
      }
    }
  } catch {}

  // Screen info
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`)
  
  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone)
  
  // Language
  components.push(navigator.language)
  
  // Platform
  components.push(navigator.platform)
  
  // Hardware concurrency
  components.push(`${navigator.hardwareConcurrency || 0}`)
  
  // Simple hash
  const str = components.join('|||')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `fp_${Math.abs(hash).toString(36)}_${str.length.toString(36)}`
}
