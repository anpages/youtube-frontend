import { getVideoDetails, getSubscriptionStatus, subscribeToChannel, unsubscribeFromChannel } from '../api.js'
import { isAuthenticated } from '../auth.js'
import { addToHistory } from '../history-store.js'
import { parseDuration, parseDurationSecs, formatCount, timeAgo, escapeHtml } from '../utils.js'
import { saveProgress } from '../progress-store.js'

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
        <div id="theater-nav" class="hidden w-full shrink-0 items-center gap-4 px-4 py-2 bg-neutral-950 border-b border-neutral-800">
          <button id="theater-back-btn" class="flex items-center gap-2 text-sm text-white/90 hover:text-white transition-colors">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
          <div class="flex gap-1">
            <a href="#/recommended"   class="px-3 py-1 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors">Recomendados</a>
            <a href="#/subscriptions" class="px-3 py-1 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors">Suscripciones</a>
            <a href="#/history"       class="px-3 py-1 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors">Historial</a>
          </div>
          <div class="ml-auto">
            <button id="theater-exit-btn" class="text-xs text-white/70 hover:text-white transition-colors flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Salir (W)
            </button>
          </div>
        </div>

        <!-- Video -->
        <div id="player-inner" class="aspect-video">
          <iframe
            src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&autoplay=1"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            loading="lazy"
            class="w-full h-full border-0"
            title="Video player"
          ></iframe>
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
  document.getElementById('theater-exit-btn').addEventListener('click', exitTheater)
  document.getElementById('theater-back-btn').addEventListener('click', () => {
    exitTheater()
    window.history.back()
  })

  enterTheater()

  // Auto-hide subnav after 3s; reveal on mouse near top or swipe down from top
  const subnav = document.getElementById('subnav')
  if (subnav) {
    subnav.style.transition = 'transform 0.3s ease, opacity 0.3s ease'
    let hideTimer = null

    function showSubnav() {
      subnav.style.transform = 'translateY(0)'
      subnav.style.opacity = '1'
      subnav.style.pointerEvents = ''
      clearTimeout(hideTimer)
      hideTimer = setTimeout(hideSubnav, 3000)
    }
    function hideSubnav() {
      subnav.style.transform = 'translateY(-100%)'
      subnav.style.opacity = '0'
      subnav.style.pointerEvents = 'none'
    }

    hideTimer = setTimeout(hideSubnav, 3000)

    function onMouseMove(e) {
      if (!document.getElementById('subnav')) { document.removeEventListener('mousemove', onMouseMove); return }
      if (e.clientY < 60) showSubnav()
    }
    document.addEventListener('mousemove', onMouseMove)

    let touchStartY = null
    function onTouchStart(e) {
      if (!document.getElementById('subnav')) { document.removeEventListener('touchstart', onTouchStart); return }
      if (e.touches[0].clientY < 60) touchStartY = e.touches[0].clientY
    }
    function onTouchMove(e) {
      if (!document.getElementById('subnav')) { document.removeEventListener('touchmove', onTouchMove); return }
      if (touchStartY !== null && e.touches[0].clientY > touchStartY + 15) {
        showSubnav()
        touchStartY = null
      }
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })

    window.addEventListener('hashchange', () => {
      clearTimeout(hideTimer)
      subnav.style.cssText = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
    }, { once: true })
  }

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape' && theater) exitTheater()
    if (e.key.toLowerCase() === 'w' && document.activeElement?.tagName !== 'INPUT') {
      theater ? exitTheater() : enterTheater()
    }
    if (!document.getElementById('player-wrap')) document.removeEventListener('keydown', onKey)
  })

  // Time-based progress tracking — starts once we know the video duration
  let progressInterval = null
  const watchStart = Date.now()

  function startProgressTracking(durationSecs) {
    if (!durationSecs) return
    progressInterval = setInterval(() => {
      const elapsed = (Date.now() - watchStart) / 1000
      saveProgress(videoId, Math.min(elapsed, durationSecs), durationSecs)
    }, 5000)
    window.addEventListener('hashchange', () => {
      clearInterval(progressInterval)
      const elapsed = (Date.now() - watchStart) / 1000
      saveProgress(videoId, Math.min(elapsed, durationSecs), durationSecs)
    }, { once: true })
  }

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
    startProgressTracking(parseDurationSecs(contentDetails?.duration))
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
