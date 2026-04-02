import { isAuthenticated, signIn } from '../auth.js'
import { getMySubscriptions, getChannelsDetails, getPlaylistVideos } from '../api.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo, escapeHtml } from '../utils.js'

const BATCH_SIZE = 12      // channels per load
const VIDEOS_PER_CH = 3    // videos per channel

let _selectedChannelId = null
let _allVideos = []
let _channels = []
let _loadedUpTo = 0
let _renderedCount = 0
let _loading = false
let _observer = null

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

function getVisibleVideos() {
  return _selectedChannelId
    ? _allVideos.filter(v => v.channelId === _selectedChannelId)
    : _allVideos
}

function renderSidebar() {
  const sidebar = document.getElementById('sub-sidebar')
  if (!sidebar) return

  sidebar.innerHTML = `
    <button
      class="sidebar-ch w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${!_selectedChannelId ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'}"
      data-id=""
    >
      Todos
    </button>
    ${_channels.map(ch => `
      <button
        class="sidebar-ch w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${_selectedChannelId === ch.id ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'}"
        data-id="${escapeHtml(ch.id)}"
      >
        ${ch.thumbnail ? `<img src="${escapeHtml(ch.thumbnail)}" alt="" class="w-6 h-6 rounded-full object-cover shrink-0" />` : ''}
        <span class="truncate">${escapeHtml(ch.title)}</span>
      </button>
    `).join('')}
  `

  sidebar.querySelectorAll('.sidebar-ch').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedChannelId = btn.dataset.id || null
      renderSidebar()
      renderVideoGrid(true)
    })
  })
}

function renderVideoGrid(reset = false) {
  const grid = document.getElementById('video-grid')
  if (!grid) return

  const videos = getVisibleVideos()

  if (reset) {
    grid.innerHTML = ''
    _renderedCount = 0
  }

  if (videos.length === 0) {
    grid.innerHTML = `<p class="col-span-3 text-neutral-500 text-sm py-8">No hay vídeos recientes.</p>`
    return
  }

  const newVideos = videos.slice(_renderedCount)
  if (newVideos.length === 0) return

  const fragment = document.createDocumentFragment()
  newVideos.forEach(v => {
    const div = document.createElement('div')
    div.innerHTML = videoCard({
      id: v.id,
      title: v.title,
      channelTitle: v.channelTitle,
      thumbnail: v.thumbnail,
      publishedAt: timeAgo(v.publishedAt),
    })
    fragment.appendChild(div.firstElementChild)
  })
  grid.appendChild(fragment)
  _renderedCount = videos.length
}

function updateSentinel() {
  const sentinel = document.getElementById('sub-sentinel')
  if (!sentinel) return
  const loadable = _channels.filter(c => c.uploadsPlaylistId)
  const hasMore = _loadedUpTo < loadable.length && !_selectedChannelId
  sentinel.innerHTML = hasMore
    ? `<div class="flex justify-center py-6">
        <svg class="animate-spin w-6 h-6 text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
      </div>`
    : ''
}

async function loadNextBatch() {
  if (_loading) return
  const loadable = _channels.filter(c => c.uploadsPlaylistId)
  if (_loadedUpTo >= loadable.length) return

  _loading = true

  const batch = loadable.slice(_loadedUpTo, _loadedUpTo + BATCH_SIZE)
  _loadedUpTo += batch.length

  const results = await Promise.allSettled(
    batch.map(ch =>
      getPlaylistVideos(ch.uploadsPlaylistId, VIDEOS_PER_CH).then(data =>
        (data.items ?? []).map(item => ({
          id: item.snippet.resourceId?.videoId ?? item.contentDetails?.videoId ?? '',
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
          publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt ?? '',
          channelId: ch.id,
          channelTitle: ch.title,
        })).filter(v => v.id)
      )
    )
  )

  for (const r of results) {
    if (r.status === 'fulfilled') _allVideos.push(...r.value)
  }
  _allVideos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  renderVideoGrid()
  updateSentinel()
  _loading = false
}

function setupInfiniteScroll() {
  _observer?.disconnect()
  const sentinel = document.getElementById('sub-sentinel')
  if (!sentinel) return
  _observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadNextBatch()
  }, { rootMargin: '200px' })
  _observer.observe(sentinel)
}

export async function renderSubscriptions() {
  const app = document.getElementById('app')
  _selectedChannelId = null
  _allVideos = []
  _channels = []
  _loadedUpTo = 0
  _loading = false
  _observer?.disconnect()

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
    <div class="flex flex-col items-center justify-center min-h-[60vh]">
      <svg class="animate-spin w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <p class="text-neutral-500 text-sm py-8">Aún no tienes suscripciones.</p>
        </div>
      `
      return
    }

    const channelIds = subs.map(s => s.snippet.resourceId.channelId)
    const channelMap = await fetchChannelMap(channelIds)
    _channels = [...channelMap.values()]

    // Render layout with sidebar immediately
    app.innerHTML = `
      <div class="flex min-h-screen">
        <aside class="w-56 shrink-0 border-r border-neutral-800 py-3 px-2 space-y-0.5 overflow-y-auto sticky top-0 max-h-screen">
          <div id="sub-sidebar" class="space-y-0.5"></div>
        </aside>
        <div class="flex-1 min-w-0 px-4 py-4">
          <div id="video-grid" class="grid grid-cols-3 gap-x-4 gap-y-6"></div>
          <div id="sub-sentinel"></div>
        </div>
      </div>
    `

    renderSidebar()
    await loadNextBatch()
    setupInfiniteScroll()
  } catch (err) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <p class="text-sm text-red-400">${escapeHtml(err.message)}</p>
      </div>
    `
  }
}
