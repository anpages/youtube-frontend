import { isAuthenticated, signIn } from '../auth.js'
import { getHistory } from '../history-store.js'
import { getChannelsDetails, getPlaylistVideos } from '../api.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo, escapeHtml } from '../utils.js'

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
        <p class="text-neutral-500 text-sm py-8">
          Aún no hay suficiente historial. Ve algunos vídeos y vuelve aquí.
        </p>
      </div>
    `
    return
  }

  app.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 pt-6 flex flex-col items-center justify-center min-h-[60vh]" id="loader-wrap">
      <svg class="animate-spin w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
      </svg>
      <p class="text-neutral-500 text-sm mt-3">Cargando recomendaciones…</p>
    </div>
  `

  try {
    const watchedIds = new Set(history.map(v => v.id))

    // Get unique channels from recent history (up to 30)
    const seenChannels = new Set()
    const recentChannelIds = []
    for (const v of history.slice(0, 60)) {
      if (v.channelId && !seenChannels.has(v.channelId)) {
        seenChannels.add(v.channelId)
        recentChannelIds.push(v.channelId)
        if (recentChannelIds.length >= 30) break
      }
    }

    // Fetch channel details to get uploads playlists
    const channelMap = new Map()
    for (let i = 0; i < recentChannelIds.length; i += 50) {
      const batch = recentChannelIds.slice(i, i + 50)
      const data = await getChannelsDetails(batch)
      for (const ch of data.items ?? []) {
        const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads
        if (uploadsPlaylistId) {
          channelMap.set(ch.id, {
            id: ch.id,
            title: ch.snippet.title,
            uploadsPlaylistId,
          })
        }
      }
    }

    // Fetch latest videos from each channel, filter out already watched
    const allVideos = []
    const channels = [...channelMap.values()]

    for (let i = 0; i < channels.length; i += 6) {
      const batch = channels.slice(i, i + 6)
      const results = await Promise.allSettled(
        batch.map(ch =>
          getPlaylistVideos(ch.uploadsPlaylistId, 10).then(data =>
            (data.items ?? [])
              .map(item => ({
                id: item.snippet.resourceId?.videoId ?? item.contentDetails?.videoId ?? '',
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
                publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt ?? '',
                channelTitle: ch.title,
                channelId: ch.id,
              }))
              .filter(v => v.id && !watchedIds.has(v.id))
          )
        )
      )
      for (const r of results) {
        if (r.status === 'fulfilled') allVideos.push(...r.value)
      }
    }

    allVideos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

    if (allVideos.length === 0) {
      app.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 pt-6">
          <h1 class="text-xl font-bold mb-4">Recomendados</h1>
          <p class="text-neutral-500 text-sm py-8">No hay vídeos nuevos en los canales que sigues.</p>
        </div>
      `
      return
    }

    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <h1 class="text-xl font-bold mb-6">Recomendados</h1>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
          ${allVideos.map(v => videoCard({
            id: v.id,
            title: v.title,
            channelTitle: v.channelTitle,
            thumbnail: v.thumbnail,
            publishedAt: timeAgo(v.publishedAt),
          })).join('')}
        </div>
      </div>
    `
  } catch (err) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <p class="text-sm text-red-400">${escapeHtml(err.message)}</p>
      </div>
    `
  }
}
