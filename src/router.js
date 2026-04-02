import { renderHome } from './pages/home.js'
import { renderSearch } from './pages/search.js'
import { renderWatch } from './pages/watch.js'
import { renderSubscriptions } from './pages/subscriptions.js'
import { renderHistory } from './pages/history.js'
import { renderRecommended } from './pages/recommended.js'
import { renderHeader } from './components/header.js'

function getRoute() {
  const hash = window.location.hash || '#/'
  const withoutHash = hash.slice(1)
  const [path, queryStr] = withoutHash.split('?')
  const params = new URLSearchParams(queryStr ?? '')
  return { path: path || '/', params }
}

async function handleRoute() {
  const { path, params } = getRoute()

  const searchQuery = path.startsWith('/search') ? (params.get('q') ?? '') : ''
  renderHeader(searchQuery, path)

  const app = document.getElementById('app')
  app.innerHTML = ''

  if (path === '/') {
    await renderHome()
  } else if (path === '/search') {
    await renderSearch(params.get('q') ?? '')
  } else if (path === '/watch') {
    await renderWatch(params.get('v') ?? '')
  } else if (path === '/subscriptions') {
    await renderSubscriptions()
  } else if (path === '/history') {
    renderHistory()
  } else if (path === '/recommended') {
    await renderRecommended()
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
