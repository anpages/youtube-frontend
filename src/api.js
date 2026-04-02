import { getToken } from './auth.js'

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY
const BASE = 'https://www.googleapis.com/youtube/v3'

// ── Public endpoints (API key) ────────────────────────────────────────────────

async function get(endpoint, params) {
  if (!API_KEY) throw new Error('Missing VITE_YOUTUBE_API_KEY in .env')
  const url = new URL(`${BASE}/${endpoint}`)
  url.searchParams.set('key', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export function getTrending(regionCode = 'US', maxResults = 24) {
  return get('videos', {
    part: 'snippet,contentDetails,statistics',
    chart: 'mostPopular',
    regionCode,
    maxResults,
  })
}

export function searchVideos(q, maxResults = 24) {
  return get('search', {
    part: 'snippet',
    q,
    type: 'video',
    maxResults,
  })
}

export function getVideoDetails(id) {
  return get('videos', {
    part: 'snippet,contentDetails,statistics',
    id,
  })
}

// ── Authenticated endpoints (OAuth token) ────────────────────────────────────

function requireToken() {
  const token = getToken()
  if (!token) throw new Error('Not authenticated')
  return token
}

async function authGet(endpoint, params = {}) {
  const token = requireToken()
  const url = new URL(`${BASE}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function authPost(endpoint, body) {
  const token = requireToken()
  const url = new URL(`${BASE}/${endpoint}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

async function authDelete(endpoint, params = {}) {
  const token = requireToken()
  const url = new URL(`${BASE}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
  return null
}

/** List the authenticated user's subscriptions (alphabetical, 50 per page) */
export function getMySubscriptions(pageToken = null) {
  const params = {
    part: 'snippet,contentDetails',
    mine: true,
    maxResults: 50,
    order: 'alphabetical',
  }
  if (pageToken) params.pageToken = pageToken
  return authGet('subscriptions', params)
}

/**
 * Check if the authenticated user is subscribed to a channel.
 * Returns the full response; items[0] contains the subscription (or items is empty).
 */
export function getSubscriptionStatus(channelId) {
  return authGet('subscriptions', {
    part: 'snippet',
    forChannelId: channelId,
    mine: true,
  })
}

/** Subscribe to a channel. Returns the new subscription resource. */
export function subscribeToChannel(channelId) {
  return authPost('subscriptions?part=snippet', {
    snippet: {
      resourceId: { kind: 'youtube#channel', channelId },
    },
  })
}

/** Unsubscribe using the subscription resource ID (not the channel ID). */
export function unsubscribeFromChannel(subscriptionId) {
  return authDelete('subscriptions', { id: subscriptionId })
}

/** Get the authenticated user's own channel info. */
export function getMyChannel() {
  return authGet('channels', {
    part: 'snippet,statistics',
    mine: true,
  })
}

/** Batch-fetch snippet + contentDetails for up to 50 channel IDs (public) */
export function getChannelsDetails(channelIds) {
  return get('channels', {
    part: 'snippet,contentDetails',
    id: channelIds.join(','),
    maxResults: 50,
  })
}

/** Get latest videos from an uploads playlist (public) */
export function getPlaylistVideos(playlistId, maxResults = 5, pageToken = null) {
  const params = { part: 'snippet,contentDetails', playlistId, maxResults }
  if (pageToken) params.pageToken = pageToken
  return get('playlistItems', params)
}
