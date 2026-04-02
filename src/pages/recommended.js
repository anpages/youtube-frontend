import { isAuthenticated, signIn } from '../auth.js'
import { getHistory } from '../history-store.js'
import { getChannelsDetails, getPlaylistVideos } from '../api.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo, escapeHtml } from '../utils.js'

const BATCH_SIZE = 10
const VIDEOS_PER_CH = 5

export async function renderRecommended() {
  const app = document.getElementById('app')

  if (!isAuthenticated()) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-12 text-center space-y-4">
        <p class="text-neutral-400">Inicia sesión para ver recomendaciones.</p>
        <button id="rec-signin-btn" class="bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-2 rounded-full text-sm font-medium transition-colors">
          Iniciar sesión con Google
        </button>
      </div>
    `
    document.getElementById('rec-signin-btn').addEventListener('click', signIn)
    return
  }

  const history = getHistory()

  if (history.length === 0) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <h1 class="text-xl font-bold mb-4">Recomendados</h1>
        <p class="text-neutral-500 text-sm py-8">Aún no hay suficiente historial. Ve algunos vídeos y vuelve aquí.</p>
      </div>
    `
    return
  }

  app.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh]">
      <svg class="animate-spin w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
      </svg>
      <p class="text-neutral-500 text-sm mt-3">Cargando recomendaciones…</p>
    </div>
  `

  try {
    const watchedIds = new Set(history.map(v => v.id))

    // Unique channels from recent history (up to 30)
    const seenChannels = new Set()
    const recentChannelIds = []
    for (const v of history.slice(0, 60)) {
      if (v.channelId && !seenChannels.has(v.channelId)) {
        seenChannels.add(v.channelId)
        recentChannelIds.push(v.channelId)
        if (recentChannelIds.length >= 30) break
      }
    }

    // Fetch channel upload playlists
    const channelMap = new Map()
    for (let i = 0; i < recentChannelIds.length; i += 50) {
      const data = await getChannelsDetails(recentChannelIds.slice(i, i + 50))
      for (const ch of data.items ?? []) {
        const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads
        if (uploadsPlaylistId) {
          channelMap.set(ch.id, { id: ch.id, title: ch.snippet.title, uploadsPlaylistId })
        }
      }
    }

    const channels = [...channelMap.values()]
    if (channels.length === 0) {
      app.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 pt-6">
          <h1 class="text-xl font-bold mb-4">Recomendados</h1>
          <p class="text-neutral-500 text-sm py-8">No hay vídeos nuevos en los canales que sigues.</p>
        </div>
      `
      return
    }

    // Render layout before loading any videos
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <h1 class="text-xl font-bold mb-6">Recomendados</h1>
        <div id="rec-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6"></div>
        <div id="rec-sentinel" class="flex justify-center py-6"></div>
      </div>
    `

    let allVideos = []
    let loadedUpTo = 0
    let loading = false
    let observer = null

    function renderGrid() {
      const grid = document.getElementById('rec-grid')
      if (!grid) return
      grid.innerHTML = allVideos.map(v => videoCard({
        id: v.id,
        title: v.title,
        channelTitle: v.channelTitle,
        thumbnail: v.thumbnail,
        publishedAt: timeAgo(v.publishedAt),
      })).join('')
    }

    function updateSentinel() {
      const sentinel = document.getElementById('rec-sentinel')
      if (!sentinel) return
      sentinel.innerHTML = loadedUpTo < channels.length
        ? `<svg class="animate-spin w-6 h-6 text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
          </svg>`
        : ''
    }

    async function loadNextBatch() {
      if (loading || loadedUpTo >= channels.length) return
      loading = true

      const batch = channels.slice(loadedUpTo, loadedUpTo + BATCH_SIZE)
      loadedUpTo += batch.length

      const results = await Promise.allSettled(
        batch.map(ch =>
          getPlaylistVideos(ch.uploadsPlaylistId, VIDEOS_PER_CH).then(data =>
            (data.items ?? []).map(item => ({
              id: item.snippet.resourceId?.videoId ?? item.contentDetails?.videoId ?? '',
              title: item.snippet.title,
              thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
              publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt ?? '',
              channelTitle: ch.title,
              channelId: ch.id,
            })).filter(v => v.id && !watchedIds.has(v.id))
          )
        )
      )

      for (const r of results) {
        if (r.status === 'fulfilled') allVideos.push(...r.value)
      }
      allVideos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

      renderGrid()
      updateSentinel()
      loading = false
    }

    function setupObserver() {
      const sentinel = document.getElementById('rec-sentinel')
      if (!sentinel) return
      observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) loadNextBatch()
      }, { rootMargin: '200px' })
      observer.observe(sentinel)
    }

    await loadNextBatch()
    setupObserver()

  } catch (err) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <p class="text-sm text-red-400">${escapeHtml(err.message)}</p>
      </div>
    `
  }
}
