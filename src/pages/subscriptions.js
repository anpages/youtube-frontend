import { isAuthenticated, signIn } from '../auth.js'
import { getMySubscriptions, getChannelsDetails, getPlaylistVideos } from '../api.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo, escapeHtml } from '../utils.js'

let _selectedChannelId = null
let _allVideos = []
let _channels = []

async function fetchAllSubscriptions() {
  const items = []
  let pageToken = null
  do {
    const data = await getMySubscriptions(pageToken)
    items.push(...(data.items ?? []))
    pageToken = data.nextPageToken ?? null
  } while (pageToken)
  return items
}

async function fetchChannelMap(channelIds) {
  const map = new Map()
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    const data = await getChannelsDetails(batch)
    for (const ch of data.items ?? []) {
      map.set(ch.id, {
        id: ch.id,
        title: ch.snippet.title,
        thumbnail: ch.snippet.thumbnails?.default?.url ?? '',
        uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads,
      })
    }
  }
  return map
}

function renderChannelChips() {
  const container = document.getElementById('channel-filters')
  if (!container) return

  container.innerHTML = `
    <button
      class="channel-chip shrink-0 flex items-center px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!_selectedChannelId ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}"
      data-id=""
    >
      Todos
    </button>
    ${_channels.map(ch => `
      <button
        class="channel-chip shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${_selectedChannelId === ch.id ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}"
        data-id="${escapeHtml(ch.id)}"
      >
        ${ch.thumbnail
          ? `<img src="${escapeHtml(ch.thumbnail)}" alt="" class="w-5 h-5 rounded-full object-cover shrink-0" />`
          : ''}
        ${escapeHtml(ch.title)}
      </button>
    `).join('')}
  `

  container.querySelectorAll('.channel-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedChannelId = btn.dataset.id || null
      renderChannelChips()
      renderVideoFeed()
    })
  })
}

function renderVideoFeed() {
  const feed = document.getElementById('video-feed')
  if (!feed) return

  const videos = _selectedChannelId
    ? _allVideos.filter(v => v.channelId === _selectedChannelId)
    : _allVideos

  if (videos.length === 0) {
    feed.innerHTML = `<p class="text-neutral-500 text-sm py-8">No hay vídeos recientes.</p>`
    return
  }

  feed.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
      ${videos.map(v => videoCard({
        id: v.id,
        title: v.title,
        channelTitle: v.channelTitle,
        thumbnail: v.thumbnail,
        publishedAt: timeAgo(v.publishedAt),
      })).join('')}
    </div>
  `
}

async function loadAllVideos(channelMap) {
  const channels = [...channelMap.values()].filter(c => c.uploadsPlaylistId)

  for (let i = 0; i < channels.length; i += 6) {
    const batch = channels.slice(i, i + 6)
    const results = await Promise.allSettled(
      batch.map(ch =>
        getPlaylistVideos(ch.uploadsPlaylistId, 10).then(data => ({
          channelId: ch.id,
          channelTitle: ch.title,
          videos: (data.items ?? []).map(item => ({
            id: item.snippet.resourceId?.videoId ?? item.contentDetails?.videoId ?? '',
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
            publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt ?? '',
            channelId: ch.id,
            channelTitle: ch.title,
          })),
        }))
      )
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        _allVideos.push(...result.value.videos)
      }
    }
  }

  _allVideos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export async function renderSubscriptions() {
  const app = document.getElementById('app')
  _selectedChannelId = null
  _allVideos = []
  _channels = []

  if (!isAuthenticated()) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-12 text-center space-y-4">
        <p class="text-neutral-400">Inicia sesión para ver tus suscripciones.</p>
        <button id="sub-signin-btn" class="bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-2 rounded-full text-sm font-medium transition-colors">
          Iniciar sesión con Google
        </button>
      </div>
    `
    document.getElementById('sub-signin-btn').addEventListener('click', signIn)
    return
  }

  app.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 pt-6 flex flex-col items-center justify-center min-h-[60vh]" id="loader-wrap">
      <svg class="animate-spin w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
      </svg>
      <p class="text-neutral-500 text-sm mt-3">Cargando suscripciones…</p>
    </div>
  `

  try {
    const subs = await fetchAllSubscriptions()

    if (subs.length === 0) {
      app.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 pt-6">
          <h1 class="text-xl font-bold mb-4">Suscripciones</h1>
          <p class="text-neutral-500 text-sm py-8">Aún no tienes suscripciones.</p>
        </div>
      `
      return
    }

    const channelIds = subs.map(s => s.snippet.resourceId.channelId)
    const channelMap = await fetchChannelMap(channelIds)
    _channels = [...channelMap.values()]

    await loadAllVideos(channelMap)

    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <h1 class="text-xl font-bold mb-4">Suscripciones</h1>
        <div id="channel-filters" class="flex gap-2 overflow-x-auto pb-3 mb-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"></div>
        <div id="video-feed"></div>
      </div>
    `

    renderChannelChips()
    renderVideoFeed()
  } catch (err) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <p class="text-sm text-red-400">${escapeHtml(err.message)}</p>
      </div>
    `
  }
}

function skeletonGrid() {
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
      ${Array.from({ length: 12 }, () => `
        <div class="space-y-2 animate-pulse">
          <div class="aspect-video bg-neutral-800 rounded-lg"></div>
          <div class="h-3 bg-neutral-800 rounded w-4/5"></div>
          <div class="h-3 bg-neutral-800 rounded w-3/5"></div>
          <div class="h-3 bg-neutral-800 rounded w-2/5"></div>
        </div>
      `).join('')}
    </div>
  `
}
