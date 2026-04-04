import { isAuthenticated, signIn } from '../auth.js'
import { getMyPlaylists, getMyChannel } from '../api.js'
import { escapeHtml } from '../utils.js'

function playlistCard({ id, title, thumbnail, itemCount }) {
  const thumb = thumbnail
    ? `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-150" />`
    : `<div class="w-full h-full bg-neutral-700 flex items-center justify-center">
        <svg class="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h10"/></svg>
       </div>`

  return `
    <a href="#/playlist?id=${encodeURIComponent(id)}" class="group flex flex-col gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg">
      <div class="relative aspect-video bg-neutral-800 rounded-lg overflow-hidden">
        ${thumb}
        <div class="absolute inset-y-0 right-0 w-1/5 bg-neutral-900/90 flex flex-col items-center justify-center gap-0.5 border-l border-neutral-800/50">
          <svg class="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h10"/>
          </svg>
          ${itemCount != null ? `<span class="text-xs text-neutral-400 tabular-nums">${escapeHtml(String(itemCount))}</span>` : ''}
        </div>
      </div>
      <div class="px-0.5">
        <h3 class="text-sm font-medium text-neutral-200 leading-snug group-hover:text-neutral-100 transition-colors line-clamp-2">
          ${escapeHtml(title)}
        </h3>
      </div>
    </a>
  `
}

export async function renderPlaylists() {
  const app = document.getElementById('app')

  if (!isAuthenticated()) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-12 text-center space-y-4">
        <p class="text-neutral-400">Inicia sesión para ver tus listas de reproducción.</p>
        <button id="pl-signin-btn" class="bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-2 rounded-full text-sm font-medium transition-colors">
          Iniciar sesión con Google
        </button>
      </div>
    `
    document.getElementById('pl-signin-btn').addEventListener('click', signIn)
    return
  }

  app.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[60vh]">
      <svg class="animate-spin w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
      </svg>
      <p class="text-neutral-500 text-sm mt-3">Cargando listas…</p>
    </div>
  `

  try {
    // Fetch user-created playlists and channel special playlists in parallel
    const [channelData, firstPage] = await Promise.all([
      getMyChannel().catch(() => null),
      getMyPlaylists(null),
    ])

    const playlists = [...(firstPage.items ?? [])]
    let pageToken = firstPage.nextPageToken ?? null
    while (pageToken) {
      const data = await getMyPlaylists(pageToken)
      playlists.push(...(data.items ?? []))
      pageToken = data.nextPageToken ?? null
    }

    // Build special playlist entries from channel info (Likes, Watch Later)
    const specialPlaylists = []
    const related = channelData?.items?.[0]?.contentDetails?.relatedPlaylists
    if (related) {
      if (related.likes) {
        specialPlaylists.push({ id: related.likes, title: 'Me gusta', thumbnail: '', itemCount: null })
      }
      // Watch Later (WL) is restricted by YouTube API for third-party apps — skip
    }

    const allPlaylists = [...specialPlaylists, ...playlists]

    if (allPlaylists.length === 0) {
      app.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 pt-6">
          <h1 class="text-xl font-bold mb-6">Listas de reproducción</h1>
          <p class="text-neutral-500 text-sm py-8">No se encontraron listas de reproducción en tu cuenta de YouTube.</p>
        </div>
      `
      return
    }

    const cards = allPlaylists.map(pl => playlistCard({
      id: pl.id,
      title: pl.title ?? pl.snippet?.title ?? '',
      thumbnail: pl.thumbnail ?? pl.snippet?.thumbnails?.medium?.url ?? pl.snippet?.thumbnails?.default?.url ?? '',
      itemCount: pl.itemCount ?? pl.contentDetails?.itemCount ?? null,
    })).join('')

    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <h1 class="text-xl font-bold mb-6">Listas de reproducción</h1>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
          ${cards}
        </div>
      </div>
    `
  } catch (err) {
    console.error('[playlists]', err)
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-6">
        <p class="text-sm text-red-400">Error al cargar las listas: ${escapeHtml(err.message)}</p>
      </div>
    `
  }
}
