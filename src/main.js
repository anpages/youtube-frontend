import './style.css'
import { initAuth } from './auth.js'
import { initRouter } from './router.js'

initAuth()
initRouter()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

// Disable browser's native pull-to-refresh so ours works cleanly
document.documentElement.style.overscrollBehaviorY = 'contain'

initPullToRefresh()

function initPullToRefresh() {
  const THRESHOLD = 80   // px of pull needed to trigger reload
  const MAX_H     = 68   // max height of the reveal area

  // Container inserted between subnav and app — grows to push content down
  const ptr = document.createElement('div')
  ptr.style.cssText = `
    overflow: hidden;
    height: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #0a0a0a;
  `
  ptr.innerHTML = `
    <div id="ptr-inner" style="display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0;">
      <svg id="ptr-svg" style="width:28px;height:28px;color:#ef4444;will-change:transform"
        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path style="opacity:.75;fill:currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
      </svg>
      <span id="ptr-label" style="font-size:11px;color:#737373;letter-spacing:0.03em">Suelta para recargar</span>
    </div>
  `

  document.getElementById('subnav').insertAdjacentElement('afterend', ptr)

  const inner  = ptr.querySelector('#ptr-inner')
  const svg    = ptr.querySelector('#ptr-svg')
  const label  = ptr.querySelector('#ptr-label')

  let startY   = 0
  let pulling  = false
  let spinning = false

  const style = document.createElement('style')
  style.textContent = `@keyframes ptr-spin { to { transform: rotate(360deg) } }`
  document.head.appendChild(style)

  document.addEventListener('touchstart', e => {
    if (spinning || window.scrollY !== 0) return
    startY  = e.touches[0].clientY
    pulling = true
    ptr.style.transition   = 'none'
    inner.style.transition = 'none'
  }, { passive: true })

  document.addEventListener('touchmove', e => {
    if (!pulling) return
    const dy = e.touches[0].clientY - startY
    if (dy <= 0) return

    const pct = Math.min(dy / THRESHOLD, 1)
    // Rubber-band resistance: content moves at half speed
    ptr.style.height  = Math.min(dy * 0.5, MAX_H) + 'px'
    inner.style.opacity = pct.toFixed(2)
    // Rotate spinner as user pulls (0 → 270°), snap to spin at threshold
    svg.style.animation = pct >= 1 ? 'ptr-spin 0.7s linear infinite' : 'none'
    if (pct < 1) svg.style.transform = `rotate(${pct * 270}deg)`
    label.textContent = pct >= 1 ? 'Suelta para recargar' : 'Desliza para recargar'
    label.style.color = pct >= 1 ? '#ef4444' : '#737373'
  }, { passive: true })

  document.addEventListener('touchend', e => {
    if (!pulling) return
    pulling = false
    const dy = e.changedTouches[0].clientY - startY

    if (dy >= THRESHOLD) {
      spinning = true
      ptr.style.transition   = 'height 0.15s ease'
      inner.style.transition = 'opacity 0.15s'
      ptr.style.height       = MAX_H + 'px'
      inner.style.opacity    = '1'
      svg.style.animation    = 'ptr-spin 0.7s linear infinite'
      setTimeout(() => window.location.reload(), 700)
    } else {
      ptr.style.transition   = 'height 0.3s ease'
      inner.style.transition = 'opacity 0.2s'
      ptr.style.height       = '0px'
      inner.style.opacity    = '0'
      setTimeout(() => {
        svg.style.animation  = 'none'
        svg.style.transform  = 'rotate(0deg)'
      }, 300)
    }
  }, { passive: true })
}
