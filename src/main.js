import './style.css'
import { initAuth } from './auth.js'
import { initRouter } from './router.js'

// Apply saved theme before first render to avoid flash
if (localStorage.getItem('yt_theme') === 'light') {
  document.documentElement.classList.add('light')
}

initAuth()
initRouter()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
