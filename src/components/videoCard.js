import { escapeHtml } from '../utils.js'

export function videoCard({ id, title, channelTitle, thumbnail, duration, viewCount, publishedAt }) {
  const meta = [viewCount ? `${viewCount} visualizaciones` : '', publishedAt].filter(Boolean).join(' · ')
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
