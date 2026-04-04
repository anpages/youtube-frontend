import { renderHome } from './pages/home.js'
import { renderWatch } from './pages/watch.js'
import { renderSubscriptions } from './pages/subscriptions.js'
import { renderHistory } from './pages/history.js'
import { renderRecommended } from './pages/recommended.js'
import { renderWatchLater } from './pages/watchlater.js'
import { renderPlaylists } from './pages/playlists.js'
import { renderPlaylist } from './pages/playlist.js'
import { renderHeader } from './components/header.js'

function getRoute() {
  const hash = window.location.hash || '#/'
  const withoutHash = hash.slice(1)
  const [path, queryStr] = withoutHash.split('?')
  const params = new URLSearchParams(queryStr ?? '')
  return { path: path || '/', params }
}

// Scroll persistence
let _scrollTimer = null
window.addEventListener('scroll', () => {
  clearTimeout(_scrollTimer)
  _scrollTimer = setTimeout(() => {
    try { sessionStorage.setItem(`sy:${getRoute().path}`, window.scrollY) } catch {}
  }, 150)
}, { passive: true })

function restoreScroll(path) {
  try {
    const y = parseInt(sessionStorage.getItem(`sy:${path}`) ?? '0')
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y))
  } catch {}
}

async function handleRoute() {
  const { path, params } = getRoute()

  renderHeader(path)

  const app = document.getElementById('app')
  app.innerHTML = ''

  if (path === '/') {
    await renderHome()
  } else if (path === '/watch') {
    await renderWatch(params.get('v') ?? '')
  } else if (path === '/subscriptions') {
    await renderSubscriptions()
    restoreScroll(path)
  } else if (path === '/history') {
    renderHistory()
    restoreScroll(path)
  } else if (path === '/recommended') {
    await renderRecommended()
    restoreScroll(path)
  } else if (path === '/watchlater') {
    renderWatchLater()
    restoreScroll(path)
  } else if (path === '/playlists') {
    await renderPlaylists()
    restoreScroll(path)
  } else if (path === '/playlist') {
    await renderPlaylist(params.get('id') ?? '', params.get('title') ?? '')
    restoreScroll(path)
  } else {
    app.innerHTML = `
      <div class="text-center py-24 space-y-3">
        <p class="text-neutral-400 text-lg">Página no encontrada</p>
        <a href="#/" class="text-sm text-red-500 hover:text-red-400 transition-colors">Volver al inicio</a>
      </div>
    `
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute)
  handleRoute()
}
