import { isAuthenticated, signIn } from '../auth.js'
import { getMySubscriptions, getChannelsDetails, getPlaylistVideos } from '../api.js'
import { getHistory } from '../history-store.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo, escapeHtml } from '../utils.js'

const BATCH_SIZE = 12      // channels per load
const VIDEOS_PER_CH = 3    // videos per channel
const CACHE_KEY = 'yt_subs_v1'
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours

function saveToStorage() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      channels: _channels,
      videos: _allVideos,
      loadedUpTo: _loadedUpTo,
    }))
  } catch {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return false
    const { ts, channels, videos, loadedUpTo } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return false
    _channels = channels
    _allVideos = videos
    _loadedUpTo = loadedUpTo ?? 0
    return true
  } catch { return false }
}

function bustStorage() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

let _selectedChannelId = null
let _allVideos = []
let _channels = []
let _loadedUpTo = 0
let _renderedCount = 0
let _loading = false
let _observer = null

// Channel-specific view state
let _chVideos = []
let _chNextPageToken = null
let _chRenderedCount = 0
let _chLoading = false

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
      class="sidebar-ch w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${!_selectedChannelId ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'}"
      data-id=""
    >
      Todos
    </button>
    ${_channels.map(ch => `
      <button
        class="sidebar-ch w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${_selectedChannelId === ch.id ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'}"
        data-id="${escapeHtml(ch.id)}"
      >
        ${ch.thumbnail ? `<img src="${escapeHtml(ch.thumbnail)}" alt="" class="w-6 h-6 rounded-full object-cover shrink-0" />` : ''}
        <span class="truncate">${escapeHtml(ch.title)}</span>
      </button>
    `).join('')}
  `

  sidebar.querySelectorAll('.sidebar-ch').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id || null
      _selectedChannelId = id
      renderSidebar()
      if (id) {
        startChannelView(id)
      } else {
        renderVideoGrid(true)
        updateSentinel()
        setupInfiniteScroll()
      }
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
  saveToStorage()
  _loading = false
}

function mapItems(ch, items) {
  return items.map(item => ({
    id: item.snippet.resourceId?.videoId ?? item.contentDetails?.videoId ?? '',
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
    publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt ?? '',
    channelId: ch.id,
    channelTitle: ch.title,
  })).filter(v => v.id)
}

function appendToGrid(videos) {
  const grid = document.getElementById('video-grid')
  if (!grid) return
  const fragment = document.createDocumentFragment()
  videos.forEach(v => {
    const div = document.createElement('div')
    div.innerHTML = videoCard({ id: v.id, title: v.title, channelTitle: v.channelTitle, thumbnail: v.thumbnail, publishedAt: timeAgo(v.publishedAt) })
    fragment.appendChild(div.firstElementChild)
  })
  grid.appendChild(fragment)
}

async function startChannelView(channelId) {
  _chVideos = []
  _chNextPageToken = null
  _chRenderedCount = 0
  _chLoading = false
  _observer?.disconnect()

  const grid = document.getElementById('video-grid')
  if (grid) grid.innerHTML = ''
  updateSentinel()

  const ch = _channels.find(c => c.id === channelId)
  if (!ch?.uploadsPlaylistId) return

  await loadChannelPage(ch)
  setupChannelScroll(ch)
}

async function loadChannelPage(ch) {
  if (_chLoading) return
  _chLoading = true

  const data = await getPlaylistVideos(ch.uploadsPlaylistId, 20, _chNextPageToken)
  const newVideos = mapItems(ch, data.items ?? [])
  _chVideos.push(...newVideos)
  _chNextPageToken = data.nextPageToken ?? null

  appendToGrid(newVideos)
  _chRenderedCount = _chVideos.length

  const sentinel = document.getElementById('sub-sentinel')
  if (sentinel) sentinel.innerHTML = _chNextPageToken
    ? `<div class="flex justify-center py-6"><svg class="animate-spin w-6 h-6 text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg></div>`
    : ''

  _chLoading = false
}

function setupChannelScroll(ch) {
  _observer?.disconnect()
  const sentinel = document.getElementById('sub-sentinel')
  if (!sentinel || !_chNextPageToken) return
  _observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadChannelPage(ch)
  }, { rootMargin: '200px' })
  _observer.observe(sentinel)
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

function buildLayout() {
  return `
    <div class="flex">
      <aside style="position:sticky;top:37px;height:calc(100vh - 37px)" class="w-72 shrink-0 border-r border-neutral-800 py-3 px-2 space-y-0.5 overflow-y-auto">
        <div id="sub-sidebar" class="space-y-0.5"></div>
      </aside>
      <div class="flex-1 min-w-0 px-4 py-4">
        <div id="video-grid" class="grid grid-cols-3 gap-x-6 gap-y-8"></div>
        <div id="sub-sentinel"></div>
      </div>
    </div>
  `
}

export async function renderSubscriptions() {
  const app = document.getElementById('app')

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

  // Check pull-to-refresh bust flag
  const forceFresh = sessionStorage.getItem('ptr_refresh') === '1'
  if (forceFresh) {
    sessionStorage.removeItem('ptr_refresh')
    bustStorage()
    _channels = []
    _allVideos = []
  }

  // Restore from module-level cache (back navigation)
  if (_channels.length > 0) {
    app.innerHTML = buildLayout()
    renderSidebar()
    if (_selectedChannelId) {
      appendToGrid(_chVideos)
      const sentinel = document.getElementById('sub-sentinel')
      if (sentinel) sentinel.innerHTML = _chNextPageToken
        ? `<div class="flex justify-center py-6"><svg class="animate-spin w-6 h-6 text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg></div>`
        : ''
      const ch = _channels.find(c => c.id === _selectedChannelId)
      if (ch) setupChannelScroll(ch)
    } else {
      _renderedCount = 0
      renderVideoGrid()
      updateSentinel()
      setupInfiniteScroll()
    }
    return
  }

  // Restore from localStorage cache (page reload within TTL)
  if (!forceFresh && loadFromStorage() && _channels.length > 0) {
    _renderedCount = 0
    _selectedChannelId = null
    app.innerHTML = buildLayout()
    renderSidebar()
    renderVideoGrid()
    updateSentinel()
    setupInfiniteScroll()
    return
  }

  _selectedChannelId = null
  _allVideos = []
  _channels = []
  _loadedUpTo = 0
  _renderedCount = 0
  _loading = false
  _observer?.disconnect()

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
    const watchCount = new Map()
    for (const v of getHistory()) {
      if (v.channelId) watchCount.set(v.channelId, (watchCount.get(v.channelId) ?? 0) + 1)
    }
    _channels = [...channelMap.values()].sort((a, b) => (watchCount.get(b.id) ?? 0) - (watchCount.get(a.id) ?? 0))

    app.innerHTML = buildLayout()

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
