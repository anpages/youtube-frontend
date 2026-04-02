import { getVideoDetails, getSubscriptionStatus, subscribeToChannel, unsubscribeFromChannel } from '../api.js'
import { isAuthenticated } from '../auth.js'
import { addToHistory } from '../history-store.js'
import { parseDuration, formatCount, timeAgo, escapeHtml } from '../utils.js'
import { saveProgress } from '../progress-store.js'

let _ytApiPromise = null

function loadYtApi() {
  if (_ytApiPromise) return _ytApiPromise
  _ytApiPromise = new Promise(resolve => {
    if (window.YT && window.YT.Player) {
      resolve()
      return
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = () => resolve()
  })
  return _ytApiPromise
}

export async function renderWatch(videoId) {
  const app = document.getElementById('app')

  if (!videoId) {
    app.innerHTML = `<div class="text-center py-16 text-neutral-500">No se especificó ningún vídeo.</div>`
    return
  }

  // Render player immediately — no waiting for API
  app.innerHTML = `
    <div class="max-w-4xl mx-auto px-4 pt-4">
      <div id="player-wrap" class="relative bg-black rounded-lg overflow-hidden group">

        <!-- Nav bar (theater mode, hidden by default) -->
        <div id="theater-nav" class="hidden w-full shrink-0 items-center px-3 py-1.5 bg-black/60">
          <button id="theater-back-btn" class="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/90 transition-colors">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
        </div>

        <!-- Video -->
        <div id="player-inner" class="aspect-video">
          <div id="yt-player" class="w-full h-full"></div>
        </div>

        <!-- Theater toggle (normal mode) -->
        <button
          id="theater-btn"
          title="Pantalla completa en ventana (W)"
          class="absolute bottom-2 right-2 z-10 bg-black/70 hover:bg-black/90 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Alternar pantalla completa en ventana"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2"/>
          </svg>
        </button>
      </div>
      <div id="video-info" class="mt-4 animate-pulse space-y-3">
        <div class="h-5 bg-neutral-800 rounded w-3/4"></div>
        <div class="h-4 bg-neutral-800 rounded w-2/5"></div>
        <div class="h-3 bg-neutral-800 rounded w-1/4 mt-1"></div>
        <div class="space-y-2 pt-2">
          <div class="h-3 bg-neutral-800 rounded"></div>
          <div class="h-3 bg-neutral-800 rounded"></div>
          <div class="h-3 bg-neutral-800 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  `

  // Theater / windowed-fullscreen toggle
  let theater = false
  const playerWrap = document.getElementById('player-wrap')
  const theaterBtn = document.getElementById('theater-btn')
  const theaterNav = document.getElementById('theater-nav')

  const playerInner = document.getElementById('player-inner')

  function enterTheater() {
    theater = true
    playerWrap.classList.add('fixed', 'inset-0', 'z-40', 'rounded-none', 'flex', 'flex-col')
    playerWrap.classList.remove('relative', 'rounded-lg')
    playerInner.classList.add('flex-1', 'min-h-0')
    playerInner.classList.remove('aspect-video')
    theaterNav.classList.remove('hidden')
    theaterNav.classList.add('flex')
    document.getElementById('header').classList.add('hidden')
    theaterBtn.classList.add('hidden')
  }

  function exitTheater() {
    theater = false
    theaterNav.classList.add('hidden')
    theaterNav.classList.remove('flex')
    playerWrap.classList.remove('fixed', 'inset-0', 'z-40', 'rounded-none', 'flex', 'flex-col')
    playerWrap.classList.add('relative', 'rounded-lg')
    playerInner.classList.add('aspect-video')
    playerInner.classList.remove('flex-1', 'min-h-0')
    document.getElementById('header').classList.remove('hidden')
    theaterBtn.classList.remove('hidden')
  }

  theaterBtn.addEventListener('click', enterTheater)
  document.getElementById('theater-back-btn').addEventListener('click', () => {
    exitTheater()
    window.history.back()
  })

  enterTheater()

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape' && theater) exitTheater()
    if (e.key.toLowerCase() === 'w' && document.activeElement?.tagName !== 'INPUT') {
      theater ? exitTheater() : enterTheater()
    }
    if (!document.getElementById('player-wrap')) document.removeEventListener('keydown', onKey)
  })

  // YT Player setup
  let ytPlayer = null
  let progressInterval = null

  function onPlayerReady() {
    progressInterval = setInterval(() => {
      if (ytPlayer) {
        saveProgress(videoId, ytPlayer.getCurrentTime(), ytPlayer.getDuration())
      }
    }, 5000)
  }

  function cleanupPlayer() {
    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = null
    }
    if (ytPlayer) {
      try {
        saveProgress(videoId, ytPlayer.getCurrentTime(), ytPlayer.getDuration())
      } catch {}
    }
  }

  window.addEventListener('hashchange', function onHashChange() {
    cleanupPlayer()
    window.removeEventListener('hashchange', onHashChange)
  }, { once: true })

  try {
    await loadYtApi()
    ytPlayer = new YT.Player('yt-player', {
      host: 'https://www.youtube-nocookie.com',
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
      events: { onReady: onPlayerReady },
    })
  } catch {}

  try {
    const data = await getVideoDetails(videoId)
    const video = data.items?.[0]
    if (!video) throw new Error('Video not found or is unavailable.')

    const { snippet, contentDetails, statistics } = video

    addToHistory({
      id: videoId,
      title: snippet.title,
      thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? '',
      channelTitle: snippet.channelTitle,
      channelId: snippet.channelId,
      publishedAt: snippet.publishedAt,
    })

    const channelId = snippet.channelId
    const duration = parseDuration(contentDetails?.duration)
    const views = formatCount(statistics?.viewCount)
    const likes = formatCount(statistics?.likeCount)
    const published = timeAgo(snippet.publishedAt)

    const chips = [duration, views && `${views} visualizaciones`, likes && `${likes} likes`, published]
      .filter(Boolean)
      .map(c => `<span class="text-xs text-neutral-400 bg-neutral-800 px-2.5 py-1 rounded-full">${escapeHtml(c)}</span>`)
      .join('')

    // Subscription state (only if logged in)
    let subId = null
    let subscribed = false
    if (isAuthenticated() && channelId) {
      try {
        const subData = await getSubscriptionStatus(channelId)
        subscribed = (subData.items?.length ?? 0) > 0
        subId = subData.items?.[0]?.id ?? null
      } catch {}
    }

    const subscribeBtn = isAuthenticated() && channelId
      ? `<button
           id="subscribe-btn"
           data-channel-id="${escapeHtml(channelId)}"
           data-sub-id="${escapeHtml(subId ?? '')}"
           data-subscribed="${subscribed}"
           class="${subscribed
             ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300'
             : 'bg-red-600 hover:bg-red-500 text-white'} px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0"
         >
           ${subscribed ? 'Suscrito' : 'Suscribirse'}
         </button>`
      : ''

    document.getElementById('video-info').innerHTML = `
      <h1 class="text-base sm:text-lg font-semibold text-neutral-100 leading-snug">
        ${escapeHtml(snippet.title)}
      </h1>
      <div class="flex items-center gap-3 mt-1 flex-wrap">
        <p class="text-sm font-medium text-neutral-300">${escapeHtml(snippet.channelTitle)}</p>
        ${subscribeBtn}
      </div>
      ${chips ? `<div class="flex flex-wrap gap-2 mt-2">${chips}</div>` : ''}
      ${snippet.description ? `
        <details class="mt-3 group">
          <summary class="text-sm text-neutral-500 hover:text-neutral-300 cursor-pointer select-none list-none flex items-center gap-1 transition-colors">
            <svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
            Descripción
          </summary>
          <p class="mt-3 text-sm text-neutral-400 whitespace-pre-wrap leading-relaxed border-l-2 border-neutral-800 pl-3">
            ${escapeHtml(snippet.description)}
          </p>
        </details>
      ` : ''}
    `

    // Subscribe / Unsubscribe button logic
    const btn = document.getElementById('subscribe-btn')
    if (btn) {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        const isSubscribed = btn.dataset.subscribed === 'true'
        try {
          if (isSubscribed) {
            await unsubscribeFromChannel(btn.dataset.subId)
            btn.dataset.subscribed = 'false'
            btn.dataset.subId = ''
            btn.textContent = 'Suscribirse'
            btn.className = 'bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0'
          } else {
            const result = await subscribeToChannel(btn.dataset.channelId)
            btn.dataset.subscribed = 'true'
            btn.dataset.subId = result.id ?? ''
            btn.textContent = 'Suscrito'
            btn.className = 'bg-neutral-700 hover:bg-neutral-600 text-neutral-300 px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0'
          }
        } catch (err) {
          alert(`Error: ${err.message}`)
        } finally {
          btn.disabled = false
        }
      })
    }
  } catch (err) {
    document.getElementById('video-info').innerHTML = `
      <p class="text-sm text-neutral-500">${escapeHtml(err.message)}</p>
    `
  }
}
