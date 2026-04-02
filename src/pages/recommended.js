import { isAuthenticated, signIn } from '../auth.js'
import { getHistory } from '../history-store.js'
import { getChannelsDetails, getPlaylistVideos, getMySubscriptions, getTrending } from '../api.js'
import { videoCard } from '../components/videoCard.js'
import { timeAgo, escapeHtml } from '../utils.js'

const BATCH_SIZE = 15
const VIDEOS_PER_CH = 8
const CACHE_KEY = 'yt_rec_v1'
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Module-level cache (back-navigation)
let _channels = []
let _allVideos = []
let _loadedUpTo = 0
let _renderedCount = 0
let _loading = false
let _observer = null
let _watchedIds = new Set()

// localStorage cache (survives page reload, avoids quota waste)
function saveToStorage() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      channels: _channels,
      videos: _allVideos,
    }))
  } catch {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return false
    const { ts, channels, videos } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return false
    _channels = channels
    _allVideos = videos
    return true
  } catch { return false }
}

function bustStorage() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

function buildLayout() {
  return `
    <div class="max-w-7xl mx-auto px-4 pt-6">
      <h1 class="text-xl font-bold mb-6">Recomendados</h1>
      <div id="rec-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6"></div>
      <div id="rec-sentinel" class="flex justify-center py-6"></div>
    </div>
  `
}

function renderGrid() {
  const grid = document.getElementById('rec-grid')
  if (!grid) return
  const newVideos = _allVideos.slice(_renderedCount)
  if (newVideos.length === 0) return
  const fragment = document.createDocumentFragment()
  newVideos.forEach(v => {
    const div = document.createElement('div')
    div.innerHTML = videoCard({ id: v.id, title: v.title, channelTitle: v.channelTitle, thumbnail: v.thumbnail, publishedAt: timeAgo(v.publishedAt) })
    fragment.appendChild(div.firstElementChild)
  })
  grid.appendChild(fragment)
  _renderedCount = _allVideos.length
}

function updateSentinel() {
  const sentinel = document.getElementById('rec-sentinel')
  if (!sentinel) return
  sentinel.innerHTML = _loadedUpTo < _channels.length
    ? `<svg class="animate-spin w-6 h-6 text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
      </svg>`
    : ''
}

async function loadNextBatch() {
  if (_loading || _loadedUpTo >= _channels.length) return
  _loading = true
  const batch = _channels.slice(_loadedUpTo, _loadedUpTo + BATCH_SIZE)
  _loadedUpTo += batch.length
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
        })).filter(v => v.id && !_watchedIds.has(v.id))
      )
    )
  )
  const seen = new Set(_allVideos.map(v => v.id))
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const v of r.value) {
        if (!seen.has(v.id)) { seen.add(v.id); _allVideos.push(v) }
      }
    }
  }
  saveToStorage()
  renderGrid()
  updateSentinel()
  _loading = false
}

function setupObserver() {
  _observer?.disconnect()
  const sentinel = document.getElementById('rec-sentinel')
  if (!sentinel) return
  _observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadNextBatch()
  }, { rootMargin: '200px' })
  _observer.observe(sentinel)
}

// Discovery via trending (1 quota unit, vs 100 per search call)
async function fetchTrendingDiscovery(watchedIds) {
  try {
    const region = (navigator.language || 'en').split('-')[1]?.toUpperCase() || 'US'
    const data = await getTrending(region, 30)
    const seen = new Set()
    return (data.items ?? [])
      .filter(item => item.id && !watchedIds.has(item.id) && !seen.has(item.id) && seen.add(item.id))
      .map(item => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
        publishedAt: item.snippet.publishedAt ?? '',
        channelTitle: item.snippet.channelTitle,
        channelId: item.snippet.channelId,
      }))
  } catch { return [] }
}

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
    _renderedCount = 0
    renderGrid()
    updateSentinel()
    setupObserver()
    return
  }

  // Restore from localStorage cache (page reload within TTL)
  if (!forceFresh && loadFromStorage() && _channels.length > 0) {
    _loadedUpTo = _channels.length
    _renderedCount = 0
    _watchedIds = new Set(getHistory().map(v => v.id))
    app.innerHTML = buildLayout()
    renderGrid()
    updateSentinel()
    setupObserver()
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
    _watchedIds = new Set(history.map(v => v.id))
    _allVideos = []
    _loadedUpTo = 0
    _renderedCount = 0

    // Channels from watch history
    const seenChannels = new Set()
    const historyChannelIds = []
    for (const v of history.slice(0, 100)) {
      if (v.channelId && !seenChannels.has(v.channelId)) {
        seenChannels.add(v.channelId)
        historyChannelIds.push(v.channelId)
        if (historyChannelIds.length >= 30) break
      }
    }

    // Subscription channels not in watch history
    const subChannelIds = []
    try {
      let pageToken = null
      do {
        const data = await getMySubscriptions(pageToken)
        for (const item of data.items ?? []) {
          const chId = item.snippet?.resourceId?.channelId
          if (chId && !seenChannels.has(chId)) {
            seenChannels.add(chId)
            subChannelIds.push(chId)
          }
        }
        pageToken = data.nextPageToken ?? null
      } while (pageToken && subChannelIds.length < 120)
    } catch {}

    // Channel details + trending discovery in parallel (trending = 1 quota unit)
    const allChannelIds = [...historyChannelIds, ...subChannelIds]
    const [channelResults, trendingVideos] = await Promise.all([
      (async () => {
        const map = new Map()
        for (let i = 0; i < allChannelIds.length; i += 50) {
          const data = await getChannelsDetails(allChannelIds.slice(i, i + 50))
          for (const ch of data.items ?? []) {
            const uploadsPlaylistId = ch.contentDetails?.relatedPlaylists?.uploads
            if (uploadsPlaylistId) map.set(ch.id, { id: ch.id, title: ch.snippet.title, uploadsPlaylistId })
          }
        }
        return map
      })(),
      fetchTrendingDiscovery(_watchedIds),
    ])

    const historyChannels = historyChannelIds.map(id => channelResults.get(id)).filter(Boolean)
    const subChannels     = subChannelIds.map(id => channelResults.get(id)).filter(Boolean)
    _channels = [...shuffle(historyChannels), ...shuffle(subChannels)]

    // Inject trending discovery videos up front so they appear mixed in
    if (trendingVideos.length > 0) {
      const seen = new Set()
      _allVideos = shuffle(trendingVideos).filter(v => !seen.has(v.id) && seen.add(v.id))
    }

    if (_channels.length === 0 && _allVideos.length === 0) {
      app.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 pt-6">
          <h1 class="text-xl font-bold mb-4">Recomendados</h1>
          <p class="text-neutral-500 text-sm py-8">No hay vídeos nuevos en los canales que sigues.</p>
        </div>
      `
      return
    }

    app.innerHTML = buildLayout()
    // Render any trending videos already in _allVideos before loading channel batch
    renderGrid()
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
