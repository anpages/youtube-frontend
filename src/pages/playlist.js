import { isAuthenticated } from '../auth.js'
import { getPlaylistDetails, getMyPlaylistVideos, getVideosDetails } from '../api.js'
import { videoCard } from '../components/videoCard.js'
import { parseDuration, formatCount, timeAgo, escapeHtml } from '../utils.js'
import { getAllProgress } from '../progress-store.js'

const SPINNER = `
  <div class="flex justify-center py-6">
    <svg class="animate-spin w-6 h-6 text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  </div>
`

export async function renderPlaylist(playlistId) {
  const app = document.getElementById('app')

  if (!playlistId) {
    app.innerHTML = `<div class="text-center py-16 text-neutral-500">Lista no especificada.</div>`
    return
  }

  if (!isAuthenticated()) {
    app.innerHTML = `<div class="text-center py-16 text-neutral-500">Inicia sesión para ver esta lista.</div>`
    return
  }

  app.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh]">
      <svg class="animate-spin w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
      </svg>
      <p class="text-neutral-500 text-sm mt-3">Cargando lista…</p>
    </div>
  `

  try {
    const plData = await getPlaylistDetails(playlistId)
    const pl = plData.items?.[0]
    if (!pl) throw new Error('Lista no encontrada.')

    const plTitle = pl.snippet.title
    const plCount = pl.contentDetails?.itemCount ?? 0

    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <div class="flex items-center gap-3 mb-6">
          <a href="#/playlists" class="text-neutral-400 hover:text-neutral-200 transition-colors shrink-0" aria-label="Volver a listas">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </a>
          <div class="min-w-0">
            <h1 class="text-xl font-bold truncate">${escapeHtml(plTitle)}</h1>
            <p class="text-sm text-neutral-400">${escapeHtml(String(plCount))} vídeos</p>
          </div>
        </div>
        <div id="playlist-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8"></div>
        <div id="playlist-sentinel">${SPINNER}</div>
      </div>
    `

    let nextPageToken = null
    let loading = false
    let observer = null

    async function loadPage() {
      if (loading) return
      loading = true

      const data = await getMyPlaylistVideos(playlistId, 50, nextPageToken)
      nextPageToken = data.nextPageToken ?? null

      const items = (data.items ?? []).filter(item => {
        const status = item.snippet?.title
        return status && status !== 'Deleted video' && status !== 'Private video'
      })

      const videoIds = items.map(item =>
        item.snippet?.resourceId?.videoId ?? item.contentDetails?.videoId ?? ''
      ).filter(Boolean)

      const grid = document.getElementById('playlist-grid')
      const sentinel = document.getElementById('playlist-sentinel')
      if (!grid) return

      if (videoIds.length > 0) {
        const detailsData = await getVideosDetails(videoIds)
        const detailsMap = new Map((detailsData.items ?? []).map(v => [v.id, v]))
        const allProgress = getAllProgress()

        const fragment = document.createDocumentFragment()
        for (const item of items) {
          const vid = item.snippet?.resourceId?.videoId ?? item.contentDetails?.videoId ?? ''
          if (!vid) continue
          const detail = detailsMap.get(vid)
          const snippet = detail?.snippet ?? item.snippet
          const contentDetails = detail?.contentDetails
          const statistics = detail?.statistics

          const div = document.createElement('div')
          div.innerHTML = videoCard({
            id: vid,
            title: snippet?.title ?? '',
            channelTitle: snippet?.channelTitle ?? item.snippet?.videoOwnerChannelTitle ?? '',
            thumbnail: snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url ?? '',
            duration: contentDetails?.duration ? parseDuration(contentDetails.duration) : null,
            viewCount: statistics?.viewCount ? formatCount(statistics.viewCount) : null,
            publishedAt: snippet?.publishedAt ? timeAgo(snippet.publishedAt) : null,
            progress: allProgress[vid] ? { seconds: allProgress[vid].seconds, duration: allProgress[vid].duration } : null,
          })
          fragment.appendChild(div.firstElementChild)
        }
        grid.appendChild(fragment)
      }

      if (sentinel) {
        sentinel.innerHTML = nextPageToken ? SPINNER : ''
      }

      loading = false

      if (!nextPageToken) {
        observer?.disconnect()
      }
    }

    function setupScroll() {
      observer?.disconnect()
      const sentinel = document.getElementById('playlist-sentinel')
      if (!sentinel) return
      observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && nextPageToken) loadPage()
      }, { rootMargin: '200px' })
      observer.observe(sentinel)
    }

    await loadPage()
    setupScroll()

  } catch (err) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <p class="text-sm text-red-400">${escapeHtml(err.message)}</p>
      </div>
    `
  }
}
