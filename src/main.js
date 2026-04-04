import './style.css'
import { initAuth } from './auth.js'
import { initRouter } from './router.js'
import { toggleWatchLater } from './watch-later-store.js'

const BOOKMARK_FILLED = `<svg class="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z"/></svg>`
const BOOKMARK_OUTLINE = `<svg class="w-4 h-4 text-white/70" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z"/></svg>`

// Global handler for save-video buttons inside video cards
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-save-id]')
  if (!btn) return
  e.preventDefault()
  const added = toggleWatchLater({
    id: btn.dataset.saveId,
    title: btn.dataset.saveTitle,
    thumbnail: btn.dataset.saveThumbnail,
    channelTitle: btn.dataset.saveChannel,
    publishedAt: btn.dataset.savePublished ?? '',
  })
  btn.dataset.saved = added ? 'true' : 'false'
  btn.title = added ? 'Quitar de Ver después' : 'Guardar para Ver después'
  btn.innerHTML = added ? BOOKMARK_FILLED : BOOKMARK_OUTLINE
})

// Apply saved theme before first render to avoid flash
if (localStorage.getItem('yt_theme') === 'light') {
  document.documentElement.classList.add('light')
}

// initAuth is async: handles OAuth callback + silent token refresh before
// the router renders, so the UI always starts with correct auth state.
await initAuth()
initRouter()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
