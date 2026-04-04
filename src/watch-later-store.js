const KEY = 'yt_watchlater_v1'
const MAX = 500

export function getWatchLater() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? [] }
  catch { return [] }
}

export function isWatchLater(id) {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    return JSON.parse(raw).some(v => v.id === id)
  } catch { return false }
}

/** Toggles a video in Watch Later. Returns true if added, false if removed. */
export function toggleWatchLater({ id, title, thumbnail, channelTitle, publishedAt }) {
  const list = getWatchLater()
  const idx = list.findIndex(v => v.id === id)
  if (idx >= 0) {
    list.splice(idx, 1)
  } else {
    list.unshift({ id, title, thumbnail, channelTitle, publishedAt: publishedAt ?? '', savedAt: Date.now() })
    if (list.length > MAX) list.length = MAX
  }
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
  return idx < 0
}

export function removeFromWatchLater(id) {
  try { localStorage.setItem(KEY, JSON.stringify(getWatchLater().filter(v => v.id !== id))) } catch {}
}

export function clearWatchLater() {
  try { localStorage.removeItem(KEY) } catch {}
}
