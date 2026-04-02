import './style.css'
import { initAuth } from './auth.js'
import { initRouter } from './router.js'

initAuth()
initRouter()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

initPullToRefresh()

function initPullToRefresh() {
  const THRESHOLD = 72

  const indicator = document.createElement('div')
  indicator.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;justify-content:center;padding:10px;transform:translateY(-100%);pointer-events:none;'
  indicator.innerHTML = `<svg style="width:24px;height:24px;color:#ef4444" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
    <path style="opacity:.75;fill:currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
  </svg>`
  document.body.prepend(indicator)

  let startY = 0
  let pulling = false

  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY
      pulling = true
      indicator.style.transition = 'none'
    }
  }, { passive: true })

  document.addEventListener('touchmove', e => {
    if (!pulling) return
    const dy = e.touches[0].clientY - startY
    if (dy <= 0) return
    const pct = Math.min(dy / THRESHOLD, 1)
    indicator.style.transform = `translateY(${-100 + pct * 100}%)`
    indicator.querySelector('svg').style.animation = pct >= 1 ? 'spin 0.7s linear infinite' : 'none'
  }, { passive: true })

  document.addEventListener('touchend', e => {
    if (!pulling) return
    pulling = false
    const dy = e.changedTouches[0].clientY - startY
    indicator.style.transition = 'transform 0.2s'
    if (dy >= THRESHOLD) {
      indicator.style.transform = 'translateY(0%)'
      setTimeout(() => window.location.reload(), 250)
    } else {
      indicator.style.transform = 'translateY(-100%)'
    }
  }, { passive: true })
}

// Keyframes for pull-to-refresh spinner (not in Tailwind since it's dynamic)
const style = document.createElement('style')
style.textContent = '@keyframes spin { to { transform: rotate(360deg) } }'
document.head.appendChild(style)
