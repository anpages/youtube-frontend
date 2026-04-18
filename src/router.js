import { renderHome } from './pages/home.js'
import { renderWatch } from './pages/watch.js'
import { renderSubscriptions } from './pages/subscriptions.js'
import { renderBiblioteca } from './pages/biblioteca.js'
import { renderRecommended } from './pages/recommended.js'
import { renderHeader } from './components/header.js'

function getRoute() {
  const hash = window.location.hash || '#/'
  const withoutHash = hash.slice(1)
  const [path, queryStr] = withoutHash.split('?')
  const params = new URLSearchParams(queryStr ?? '')
  return { path: path || '/', params }
}

let _prevPath = null
const _scrollSave = {}

function saveScroll(path) {
  if (path === '/subscriptions') {
    const el = document.getElementById('video-scroll')
    if (el) _scrollSave[path] = el.scrollTop
  } else {
    _scrollSave[path] = window.scrollY
  }
}

function restoreScroll(path) {
  const y = _scrollSave[path] ?? 0
  if (path === '/subscriptions') {
    document.getElementById('video-scroll')?.scrollTo({ top: y })
  } else if (y > 0) {
    requestAnimationFrame(() => window.scrollTo(0, y))
  }
}

async function handleRoute() {
  const { path, params } = getRoute()
  const fromWatch = _prevPath === '/watch'

  if (_prevPath) saveScroll(_prevPath)

  renderHeader(path)

  if (!fromWatch) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const app = document.getElementById('app')
  app.innerHTML = ''

  if (path === '/') {
    await renderHome()
  } else if (path === '/watch') {
    await renderWatch(params.get('v') ?? '')
  } else if (path === '/subscriptions') {
    await renderSubscriptions()
    if (fromWatch) restoreScroll(path)
  } else if (path === '/history' || path === '/watchlater') {
    // Legacy redirects → biblioteca
    window.location.hash = '/biblioteca'
  } else if (path === '/biblioteca') {
    renderBiblioteca()
    if (fromWatch) restoreScroll(path)
  } else if (path === '/recommended') {
    await renderRecommended()
    if (fromWatch) restoreScroll(path)
  } else {
    app.innerHTML = `
      <div class="text-center py-24 space-y-3">
        <p class="text-neutral-400 text-lg">Página no encontrada</p>
        <a href="#/" class="text-sm text-red-500 hover:text-red-400 transition-colors">Volver al inicio</a>
      </div>
    `
  }

  _prevPath = path
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute)
  handleRoute()
}
