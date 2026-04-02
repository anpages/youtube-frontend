function skeletonCard() {
  return `
    <div class="flex flex-col gap-2 animate-pulse">
      <div class="aspect-video bg-neutral-800 rounded-lg"></div>
      <div class="px-0.5 space-y-2">
        <div class="h-3.5 bg-neutral-800 rounded w-full"></div>
        <div class="h-3.5 bg-neutral-800 rounded w-3/4"></div>
        <div class="h-3 bg-neutral-800 rounded w-1/2 mt-1"></div>
      </div>
    </div>
  `
}

export function skeletonGrid(count = 12) {
  return `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
    ${Array.from({ length: count }, skeletonCard).join('')}
  </div>`
}
