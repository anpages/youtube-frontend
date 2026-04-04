import { isAuthenticated, signIn } from '../auth.js'
import { getHistory, clearHistory } from '../history-store.js'
import { getWatchLater, clearWatchLater } from '../watch-later-store.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo } from '../utils.js'
import { getAllProgress } from '../progress-store.js'

export function renderBiblioteca() {
  const app = document.getElementById('app')

  if (!isAuthenticated()) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-12 text-center space-y-4">
        <p class="text-neutral-400">Inicia sesión para ver tu biblioteca.</p>
        <button id="bib-signin-btn" class="bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-2 rounded-full text-sm font-medium transition-colors">
          Iniciar sesión con Google
        </button>
      </div>
    `
    document.getElementById('bib-signin-btn').addEventListener('click', signIn)
    return
  }

  function render() {
    const allProgress = getAllProgress()
    const watchLater = getWatchLater()
    const history = getHistory()

    const inProgress = []
    const watched = []
    for (const v of history) {
      const p = allProgress[v.id]
      const ratio = p && p.duration ? p.seconds / p.duration : 0
      if (ratio >= 0.05 && ratio < 0.92) inProgress.push(v)
      else if (ratio >= 0.92) watched.push(v)
      // ratio < 0.05: being rewatched from start or barely seen — hide from both sections
    }

    function grid(videos, mapFn) {
      return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
        ${videos.map(mapFn).join('')}
      </div>`
    }

    const watchLaterGrid = grid(watchLater, v => videoCard({
      id: v.id,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      progress: allProgress[v.id] ? { seconds: allProgress[v.id].seconds, duration: allProgress[v.id].duration } : null,
    }))

    const inProgressGrid = grid(inProgress, v => videoCard({
      id: v.id,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnail: v.thumbnail,
      publishedAt: timeAgo(v.watchedAt),
      progress: allProgress[v.id] ? { seconds: allProgress[v.id].seconds, duration: allProgress[v.id].duration } : null,
    }))

    const watchedGrid = grid(watched, v => videoCard({
      id: v.id,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnail: v.thumbnail,
      publishedAt: timeAgo(v.watchedAt),
      progress: allProgress[v.id] ? { seconds: allProgress[v.id].seconds, duration: allProgress[v.id].duration } : null,
    }))

    const hasHistory = history.length > 0

    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6 space-y-10">

        <!-- Ver después -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-neutral-300 uppercase tracking-wide">Ver después</h2>
            ${watchLater.length > 0
              ? `<button id="wl-clear-btn" class="text-xs text-neutral-500 hover:text-red-400 transition-colors">Borrar todo</button>`
              : ''}
          </div>
          ${watchLater.length === 0
            ? `<p class="text-neutral-500 text-sm">Nada guardado. Pulsa el marcador en cualquier vídeo para guardarlo aquí.</p>`
            : watchLaterGrid
          }
        </section>

        <!-- Seguir viendo -->
        ${inProgress.length > 0 ? `
          <section>
            <h2 class="text-base font-semibold text-neutral-300 uppercase tracking-wide mb-4">Seguir viendo</h2>
            ${inProgressGrid}
          </section>
        ` : ''}

        <!-- Ya vistos -->
        ${watched.length > 0 ? `
          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold text-neutral-300 uppercase tracking-wide">Ya vistos</h2>
              ${hasHistory
                ? `<button id="hist-clear-btn" class="text-xs text-neutral-500 hover:text-red-400 transition-colors">Borrar historial</button>`
                : ''}
            </div>
            ${watchedGrid}
          </section>
        ` : ''}

        ${!hasHistory && watchLater.length === 0
          ? `<p class="text-neutral-500 text-sm py-8">Tu biblioteca está vacía.</p>`
          : ''}
      </div>
    `

    document.getElementById('wl-clear-btn')?.addEventListener('click', () => {
      if (!confirm('¿Borrar los vídeos guardados para ver después?')) return
      clearWatchLater()
      render()
    })

    document.getElementById('hist-clear-btn')?.addEventListener('click', () => {
      if (!confirm('¿Borrar todo el historial?')) return
      clearHistory()
      render()
    })
  }

  render()
}
