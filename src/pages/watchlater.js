import { isAuthenticated, signIn } from '../auth.js'
import { getWatchLater, clearWatchLater } from '../watch-later-store.js'
import { videoCard } from '../components/videoCard.js'
import { getAllProgress } from '../progress-store.js'

export function renderWatchLater() {
  const app = document.getElementById('app')

  if (!isAuthenticated()) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-12 text-center space-y-4">
        <p class="text-neutral-400">Inicia sesión para usar Ver después.</p>
        <button id="wl-signin-btn" class="bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-2 rounded-full text-sm font-medium transition-colors">
          Iniciar sesión con Google
        </button>
      </div>
    `
    document.getElementById('wl-signin-btn').addEventListener('click', signIn)
    return
  }

  function render() {
    const list = getWatchLater()
    const allProgress = getAllProgress()

    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-xl font-bold">Ver después</h1>
          ${list.length > 0
            ? `<button id="wl-clear-btn" class="text-xs text-neutral-500 hover:text-red-400 transition-colors">Borrar todo</button>`
            : ''}
        </div>
        ${list.length === 0
          ? `<p class="text-neutral-500 text-sm py-8">No tienes vídeos guardados. Usa el marcador en cualquier tarjeta para guardarlos aquí.</p>`
          : `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
              ${list.map(v => videoCard({
                id: v.id,
                title: v.title,
                channelTitle: v.channelTitle,
                thumbnail: v.thumbnail,
                publishedAt: v.publishedAt,
                progress: allProgress[v.id] ? { seconds: allProgress[v.id].seconds, duration: allProgress[v.id].duration } : null,
              })).join('')}
             </div>`
        }
      </div>
    `

    document.getElementById('wl-clear-btn')?.addEventListener('click', () => {
      if (!confirm('¿Borrar todos los vídeos guardados?')) return
      clearWatchLater()
      render()
    })
  }

  render()
}
