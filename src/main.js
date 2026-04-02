import './style.css'
import { initAuth } from './auth.js'
import { initRouter } from './router.js'

initAuth()
initRouter()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
