const KEY = 'yt_progress_v1'
const MAX = 500

export function saveProgress(videoId, seconds, duration) {
  if (!videoId || !duration || duration < 10) return
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    data[videoId] = { seconds: Math.floor(seconds), duration: Math.floor(duration), ts: Date.now() }
    const entries = Object.entries(data)
    if (entries.length > MAX) {
      const pruned = Object.fromEntries(entries.sort((a,b) => b[1].ts - a[1].ts).slice(0, MAX))
      localStorage.setItem(KEY, JSON.stringify(pruned))
    } else {
      localStorage.setItem(KEY, JSON.stringify(data))
    }
  } catch {}
}

export function getProgress(videoId) {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const e = data[videoId]
    if (!e || !e.duration) return null
    return { seconds: e.seconds, duration: e.duration, ratio: e.seconds / e.duration }
  } catch { return null }
}

export function getAllProgress() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}
