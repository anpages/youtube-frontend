import { isAuthenticated, getUserInfo, signIn, signOut } from '../auth.js'
import { getMyChannel } from '../api.js'
import { formatCount, escapeHtml } from '../utils.js'

export async function renderProfile() {
  const app = document.getElementById('app')

  if (!isAuthenticated()) {
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 pt-12 text-center space-y-4">
        <p class="text-neutral-400">Inicia sesión para ver tu perfil.</p>
        <button id="profile-signin-btn" class="bg-red-600 hover:bg-red-500 px-5 py-2 rounded-full text-sm font-medium transition-colors">
          Iniciar sesión con Google
        </button>
      </div>
    `
    document.getElementById('profile-signin-btn').addEventListener('click', signIn)
    return
  }

  const user = getUserInfo()

  // Show user info immediately, then load channel stats
  app.innerHTML = `
    <div class="max-w-2xl mx-auto px-4 pt-8 space-y-6">
      <div class="flex items-center gap-5">
        ${user?.picture
          ? `<img src="${escapeHtml(user.picture)}" alt="${escapeHtml(user.name)}" class="w-20 h-20 rounded-full border-2 border-neutral-700" />`
          : `<div class="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-2xl font-bold">${escapeHtml(initials(user?.name))}</div>`
        }
        <div>
          <h1 class="text-xl font-bold text-neutral-100">${escapeHtml(user?.name ?? '')}</h1>
          <p class="text-sm text-neutral-500">${escapeHtml(user?.email ?? '')}</p>
        </div>
      </div>

      <div id="channel-stats" class="animate-pulse space-y-2">
        <div class="h-4 bg-neutral-800 rounded w-1/3"></div>
        <div class="h-4 bg-neutral-800 rounded w-1/4"></div>
      </div>

      <div class="flex flex-wrap gap-3 pt-2">
        <a
          href="#/subscriptions"
          class="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-full text-sm font-medium transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          Mis suscripciones
        </a>
        <button
          id="profile-signout-btn"
          class="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-900 px-4 py-2 rounded-full text-sm font-medium transition-colors text-red-400 hover:text-red-300"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  `

  document.getElementById('profile-signout-btn').addEventListener('click', () => {
    signOut()
    window.location.hash = '/'
  })

  try {
    const data = await getMyChannel()
    const channel = data.items?.[0]
    const stats = channel?.statistics
    const statsEl = document.getElementById('channel-stats')

    if (!channel) {
      statsEl.innerHTML = `<p class="text-sm text-neutral-500">No hay ningún canal de YouTube vinculado a esta cuenta.</p>`
      return
    }

    const rows = [
      stats?.subscriberCount && `<span class="text-sm text-neutral-300">${formatCount(stats.subscriberCount)} suscriptores</span>`,
      stats?.videoCount && `<span class="text-sm text-neutral-300">${formatCount(stats.videoCount)} vídeos</span>`,
      stats?.viewCount && `<span class="text-sm text-neutral-300">${formatCount(stats.viewCount)} visualizaciones totales</span>`,
    ].filter(Boolean)

    statsEl.className = 'space-y-1'
    statsEl.innerHTML = `
      <p class="text-sm font-medium text-neutral-400">Tu canal</p>
      <p class="text-base font-semibold text-neutral-100">${escapeHtml(channel.snippet?.title ?? '')}</p>
      <div class="flex flex-wrap gap-3 mt-1">${rows.join('')}</div>
    `
  } catch {
    document.getElementById('channel-stats').innerHTML = ''
  }
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
