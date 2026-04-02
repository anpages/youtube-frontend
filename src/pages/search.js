import { searchVideos, getVideoDetails } from '../api.js'
import { videoCard } from '../components/videoCard.js'
import { skeletonGrid } from '../components/skeleton.js'
import { parseDuration, timeAgo, escapeHtml } from '../utils.js'

export async function renderSearch(query) {
  const app = document.getElementById('app')

  if (!query) {
    app.innerHTML = `<div class="text-center py-16 text-neutral-500">Escribe algo para buscar.</div>`
    return
  }

  app.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 pt-6">
      <h2 class="text-base font-semibold text-neutral-400 mb-4">
        Resultados para <span class="text-neutral-100">"${escapeHtml(query)}"</span>
      </h2>
      <div id="grid">${skeletonGrid()}</div>
    </div>
  `

  try {
    const data = await searchVideos(query)
    const items = (data.items ?? []).filter(i => i.id?.videoId)

    if (items.length === 0) {
      document.getElementById('grid').innerHTML = `
        <div class="text-center py-16 text-neutral-500">Sin resultados para "${escapeHtml(query)}"</div>
      `
      return
    }

    // Batch-fetch durations — one extra call, combined IDs
    const ids = items.map(i => i.id.videoId).join(',')
    const durMap = {}
    try {
      const details = await getVideoDetails(ids)
      for (const v of details.items ?? []) {
        durMap[v.id] = parseDuration(v.contentDetails?.duration)
      }
    } catch {
      // durations are non-critical, continue without them
    }

    document.getElementById('grid').innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
        ${items.map(item => videoCard({
          id: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
          duration: durMap[item.id.videoId] ?? '',
          publishedAt: timeAgo(item.snippet.publishedAt),
        })).join('')}
      </div>
    `
  } catch (err) {
    document.getElementById('grid').innerHTML = `
      <div class="text-center py-16 space-y-2">
        <p class="text-neutral-400">Error en la búsqueda</p>
        <p class="text-sm text-neutral-600">${escapeHtml(err.message)}</p>
      </div>
    `
  }
}
