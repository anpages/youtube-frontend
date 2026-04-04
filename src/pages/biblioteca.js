import { isAuthenticated, signIn } from '../auth.js'
import { getHistory, removeFromHistory, clearHistory } from '../history-store.js'
import { getWatchLater, removeFromWatchLater, clearWatchLater } from '../watch-later-store.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo } from '../utils.js'
import { getAllProgress } from '../progress-store.js'

const DELETE_BTN = (id, store) => `
  <button
    class="bib-delete absolute top-1 left-1 z-20 bg-black/70 hover:bg-red-600 p-1.5 rounded transition-colors"
    data-delete-id="${id}"
    data-delete-store="${store}"
    aria-label="Eliminar"
    title="Eliminar"
  >
    <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
    </svg>
  </button>
`

function deletableCard(v, cardProps, store) {
  return `
    <div class="relative">
      ${videoCard(cardProps)}
      ${DELETE_BTN(v.id, store)}
    </div>
  `
}

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
    }

    function grid(videos, mapFn) {
      return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
        ${videos.map(mapFn).join('')}
      </div>`
    }

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
            : grid(watchLater, v => deletableCard(v, {
                id: v.id, title: v.title, channelTitle: v.channelTitle,
                thumbnail: v.thumbnail, publishedAt: v.publishedAt,
                progress: allProgress[v.id] ? { seconds: allProgress[v.id].seconds, duration: allProgress[v.id].duration } : null,
              }, 'watchlater'))
          }
        </section>

        <!-- Seguir viendo -->
        ${inProgress.length > 0 ? `
          <section>
            <h2 class="text-base font-semibold text-neutral-300 uppercase tracking-wide mb-4">Seguir viendo</h2>
            ${grid(inProgress, v => deletableCard(v, {
                id: v.id, title: v.title, channelTitle: v.channelTitle,
                thumbnail: v.thumbnail, publishedAt: timeAgo(v.watchedAt),
                progress: allProgress[v.id] ? { seconds: allProgress[v.id].seconds, duration: allProgress[v.id].duration } : null,
              }, 'history'))}
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
            ${grid(watched, v => deletableCard(v, {
                id: v.id, title: v.title, channelTitle: v.channelTitle,
                thumbnail: v.thumbnail, publishedAt: timeAgo(v.watchedAt),
                progress: allProgress[v.id] ? { seconds: allProgress[v.id].seconds, duration: allProgress[v.id].duration } : null,
              }, 'history'))}
          </section>
        ` : ''}

        ${!hasHistory && watchLater.length === 0
          ? `<p class="text-neutral-500 text-sm py-8">Tu biblioteca está vacía.</p>`
          : ''}
      </div>
    `

    app.querySelectorAll('.bib-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault()
        const id = btn.dataset.deleteId
        if (btn.dataset.deleteStore === 'watchlater') {
          removeFromWatchLater(id)
        } else {
          removeFromHistory(id)
        }
        render()
      })
    })

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
