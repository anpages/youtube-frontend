import { isAuthenticated, signIn } from '../auth.js'

export function renderHome() {
  if (isAuthenticated()) {
    window.location.hash = '/recommended'
    return
  }

  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <div class="flex items-center gap-3 mb-6">
        <svg viewBox="0 0 24 24" class="w-12 h-12 fill-red-500" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        <h1 class="text-3xl font-bold text-neutral-100">YTube Lite</h1>
      </div>

      <p class="text-neutral-400 text-lg max-w-md mb-2">
        Una interfaz ligera de YouTube para ordenadores de bajos recursos.
      </p>
      <p class="text-neutral-600 text-sm max-w-sm mb-10">
        Sin publicidad, sin recomendaciones invasivas, sin consumo innecesario de recursos.
        Solo lo que necesitas.
      </p>

      <ul class="text-left space-y-3 mb-10 text-sm text-neutral-400 max-w-xs w-full">
        <li class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          <span>Feed de tus <strong class="text-neutral-300">suscripciones</strong> en orden cronológico</span>
        </li>
        <li class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span><strong class="text-neutral-300">Historial</strong> de vídeos vistos</span>
        </li>
        <li class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 3l14 9-14 9V3z"/>
          </svg>
          <span>Vídeos <strong class="text-neutral-300">recomendados</strong> basados en lo que ves</span>
        </li>
      </ul>

      <button
        id="landing-signin-btn"
        class="flex items-center gap-3 bg-white hover:bg-neutral-100 text-neutral-900 font-medium px-6 py-3 rounded-full text-sm transition-colors shadow-lg"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Iniciar sesión con Google
      </button>
    </div>
  `

  document.getElementById('landing-signin-btn').addEventListener('click', signIn)

  document.addEventListener('auth-changed', () => {
    if (isAuthenticated()) window.location.hash = '/recommended'
  }, { once: true })
}
