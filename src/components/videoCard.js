import { escapeHtml } from '../utils.js'

export function videoCard({ id, title, channelTitle, thumbnail, duration, viewCount, publishedAt, progress = null }) {
  const meta = [viewCount ? `${viewCount} visualizaciones` : '', publishedAt].filter(Boolean).join(' · ')
  const ratio = progress && progress.duration ? progress.seconds / progress.duration : null

  let progressOverlay = ''
  if (ratio !== null) {
    if (ratio >= 0.92) {
      // "Watched" badge overlay
      progressOverlay = `
        <div class="absolute inset-0 bg-black/50 flex items-end justify-start p-1.5 pointer-events-none">
          <span class="text-xs font-medium text-white/90 bg-black/70 px-1.5 py-0.5 rounded">&#10003; Visto</span>
        </div>
      `
    } else if (ratio >= 0.05) {
      // Progress bar
      const pct = Math.round(ratio * 100)
      progressOverlay = `
        <div class="absolute bottom-0 left-0 right-0 h-[3px] bg-black/50 pointer-events-none">
          <div class="h-full bg-red-500" style="width:${pct}%"></div>
        </div>
      `
    }
  }

  return `
    <a href="#/watch?v=${encodeURIComponent(id)}" class="group flex flex-col gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg">
      <div class="relative aspect-video bg-neutral-800 rounded-lg overflow-hidden">
        <img
          src="${escapeHtml(thumbnail)}"
          alt="${escapeHtml(title)}"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-150"
        />
        ${duration ? `<span class="absolute bottom-1 right-1 bg-black/80 text-xs px-1.5 py-0.5 rounded text-white font-medium tabular-nums">${escapeHtml(duration)}</span>` : ''}
        ${progressOverlay}
      </div>
      <div class="px-0.5">
        <h3 class="text-sm font-medium text-neutral-200 leading-snug group-hover:text-neutral-100 transition-colors">
          ${escapeHtml(title)}
        </h3>
        <p class="text-xs text-neutral-400 mt-1 truncate">${escapeHtml(channelTitle)}</p>
        ${meta ? `<p class="text-xs text-neutral-500 mt-0.5">${escapeHtml(meta)}</p>` : ''}
      </div>
    </a>
  `
}
