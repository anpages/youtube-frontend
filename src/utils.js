export function parseDuration(iso) {
  if (!iso) return ''
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return ''
  const h = parseInt(m[1] || 0)
  const min = parseInt(m[2] || 0)
  const s = parseInt(m[3] || 0)
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${min}:${String(s).padStart(2, '0')}`
}

export function formatCount(n) {
  if (!n) return ''
  const v = parseInt(n)
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return v.toString()
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const mo = Math.floor(d / 30)
  const y = Math.floor(mo / 12)
  if (y > 0) return `hace ${y} ${y > 1 ? 'años' : 'año'}`
  if (mo > 0) return `hace ${mo} ${mo > 1 ? 'meses' : 'mes'}`
  if (d > 0) return `hace ${d} ${d > 1 ? 'días' : 'día'}`
  if (h > 0) return `hace ${h} ${h > 1 ? 'horas' : 'hora'}`
  if (m > 0) return `hace ${m} ${m > 1 ? 'minutos' : 'minuto'}`
  return 'ahora mismo'
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
