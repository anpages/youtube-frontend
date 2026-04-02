import { isAuthenticated, getUserInfo, signIn, signOut } from '../auth.js'
import { getQuotaUsage } from '../api.js'

const NAV_LINKS = [
  { href: '#/recommended',   label: 'Recomendados',  path: '/recommended'   },
  { href: '#/subscriptions', label: 'Suscripciones', path: '/subscriptions' },
  { href: '#/history',       label: 'Historial',     path: '/history'       },
]

export function renderHeader(currentPath = '/') {
  const user = getUserInfo()
  const authed = isAuthenticated()

  const { used, limit } = getQuotaUsage()
  const quotaPct = used / limit
  const quotaColor = quotaPct >= 0.8 ? '#ef4444' : quotaPct >= 0.5 ? '#f59e0b' : '#22c55e'
  const quotaBadge = authed ? `
    <span id="quota-badge" title="Quota API YouTube hoy (se renueva a medianoche hora del Pacífico)"
      style="font-size:11px;color:${quotaColor};white-space:nowrap;cursor:default"
      class="shrink-0 hidden sm:inline">
      ${used.toLocaleString()} / ${limit.toLocaleString()}
    </span>
  ` : ''

  const authSection = authed
    ? `
      <button id="refresh-btn" title="Actualizar" aria-label="Actualizar"
        class="shrink-0 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 p-2 rounded-full text-neutral-300 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
      <button
        id="sign-out-btn"
        class="shrink-0 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 px-3 py-1.5 rounded-full text-sm font-medium text-neutral-300 transition-colors"
      >
        Cerrar sesión
      </button>
    `
    : `
      <button
        id="sign-in-btn"
        class="shrink-0 flex items-center gap-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        <span class="hidden sm:inline">Iniciar sesión</span>
      </button>
    `

  const header = document.getElementById('header')
  header.classList.remove('hidden')

  if (currentPath === '/' && !authed) {
    header.innerHTML = ''
    return
  }

  header.innerHTML = `
    <div class="bg-neutral-950 border-b border-neutral-800">
      <nav class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <a href="#/" class="text-red-500 font-bold text-lg shrink-0 flex items-center gap-1.5" aria-label="Home">
          <svg viewBox="0 0 24 24" class="w-6 h-6 fill-current" aria-hidden="true">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <span class="hidden sm:inline">YTube</span>
        </a>
        <div class="flex-1"></div>
        ${quotaBadge}
        ${authSection}
      </nav>
    </div>
  `

  const subnav = document.getElementById('subnav')
  if (subnav) {
    subnav.className = authed ? 'sticky top-0 z-50 bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-800' : ''
    subnav.innerHTML = authed ? `
      <div class="max-w-7xl mx-auto px-4 flex items-center gap-1">
        ${currentPath === '/watch' ? `
          <button id="subnav-back-btn" class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors mr-2">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
          <div class="w-px h-4 bg-neutral-700 mr-1"></div>
        ` : ''}
        ${NAV_LINKS.map(({ href, label, path }) => `
          <a href="${href}" class="px-3 py-2 text-sm font-medium transition-colors ${currentPath === path ? 'text-white border-b-2 border-red-500' : 'text-neutral-400 hover:text-neutral-200'}">
            ${label}
          </a>
        `).join('')}
      </div>
    ` : ''
  }

  document.getElementById('subnav-back-btn')?.addEventListener('click', () => window.history.back())

  if (authed) {
    document.getElementById('refresh-btn').addEventListener('click', () => {
      try { sessionStorage.setItem('ptr_refresh', '1') } catch {}
      window.location.reload()
    })
    document.getElementById('sign-out-btn').addEventListener('click', () => {
      signOut()
      window.location.hash = '/'
    })
  } else {
    document.getElementById('sign-in-btn').addEventListener('click', () => {
      signIn()
    })
  }
}

function getCurrentPath() {
  const hash = window.location.hash || '#/'
  return hash.slice(1).split('?')[0] || '/'
}

// Re-render header when auth state or quota changes
document.addEventListener('auth-changed', () => renderHeader(getCurrentPath()))
document.addEventListener('quota-updated', () => {
  const badge = document.getElementById('quota-badge')
  if (!badge) return
  const { used, limit } = getQuotaUsage()
  const pct = used / limit
  badge.style.color = pct >= 0.8 ? '#ef4444' : pct >= 0.5 ? '#f59e0b' : '#22c55e'
  badge.textContent = `${used.toLocaleString()} / ${limit.toLocaleString()}`
})

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
