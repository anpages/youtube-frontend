const KEY = 'yt_history_v1'
const MAX = 500

export function addToHistory({ id, title, thumbnail, channelTitle, channelId, publishedAt }) {
  const history = getHistory().filter(v => v.id !== id)
  history.unshift({ id, title, thumbnail, channelTitle, channelId, publishedAt, watchedAt: new Date().toISOString() })
  if (history.length > MAX) history.splice(MAX)
  try { localStorage.setItem(KEY, JSON.stringify(history)) } catch {}
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function clearHistory() {
  localStorage.removeItem(KEY)
}
