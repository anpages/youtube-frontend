import { isAuthenticated, signIn } from '../auth.js'
import { getHistory, clearHistory } from '../history-store.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo } from '../utils.js'
import { getAllProgress } from '../progress-store.js'

export function renderHistory() {
  const app = document.getElementById('app')

  if (!isAuthenticated()) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-12 text-center space-y-4">
        <p class="text-neutral-400">Inicia sesión para ver tu historial.</p>
        <button id="history-signin-btn" class="bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-2 rounded-full text-sm font-medium transition-colors">
          Iniciar sesión con Google
        </button>
      </div>
    `
    document.getElementById('history-signin-btn').addEventListener('click', signIn)
    return
  }

  function render() {
    const history = getHistory()
    const allProgress = getAllProgress()

    // Split into in-progress and watched
    const inProgress = []
    const watched = []

    for (const v of history) {
      const p = allProgress[v.id]
      const ratio = p && p.duration ? p.seconds / p.duration : 0
      if (ratio >= 0.05 && ratio < 0.92) {
        inProgress.push(v)
      } else {
        watched.push(v)
      }
    }

    function grid(videos) {
      return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
        ${videos.map(v => videoCard({
          id: v.id,
          title: v.title,
          channelTitle: v.channelTitle,
          thumbnail: v.thumbnail,
          publishedAt: timeAgo(v.watchedAt),
          progress: allProgress[v.id] ? { seconds: allProgress[v.id].seconds, duration: allProgress[v.id].duration } : null,
        })).join('')}
      </div>`
    }

    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-xl font-bold">Seguir viendo</h1>
          ${history.length > 0
            ? `<button id="clear-history-btn" class="text-xs text-neutral-500 hover:text-red-400 transition-colors">
                Borrar historial
              </button>`
            : ''}
        </div>
        ${history.length === 0
          ? `<p class="text-neutral-500 text-sm py-8">Aún no has visto ningún vídeo en YTube.</p>`
          : `
            ${inProgress.length > 0 ? `
              <div class="mb-10">
                <h2 class="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">Continuar viendo</h2>
                ${grid(inProgress)}
              </div>
            ` : ''}
            ${watched.length > 0 ? `
              <div>
                ${inProgress.length > 0 ? `<h2 class="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">Ya vistos</h2>` : ''}
                ${grid(watched)}
              </div>
            ` : ''}
          `
        }
      </div>
    `

    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
      if (!confirm('¿Borrar todo el historial?')) return
      clearHistory()
      render()
    })
  }

  render()
}
