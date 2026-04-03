// OAuth 2.0 Authorization Code + PKCE — no backend, no GIS library
//
// Uses a "Desktop app" OAuth client type in Google Cloud Console, which allows
// the client_secret to live in the frontend (it's a public client by design,
// the same model used by Chrome Extensions and native apps).
//
// This gives us real refresh tokens → sessions survive indefinitely without
// requiring the user to re-authenticate.
//
// Required env vars:
//   VITE_GOOGLE_CLIENT_ID      — OAuth client ID
//   VITE_GOOGLE_CLIENT_SECRET  — OAuth client secret (Desktop app type = public)
//
// Google Cloud Console setup:
//   Credentials → OAuth 2.0 Client IDs → Desktop app
//   Authorized redirect URIs: http://localhost:5173  and  https://your-production-url

const SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'openid',
  'profile',
  'email',
].join(' ')

const STORAGE_KEY     = 'yt_auth_v2'
const SESSION_KEY     = 'yt_had_session'
const PKCE_KEY        = 'yt_pkce_verifier'
const RETURN_HASH_KEY = 'yt_auth_return'

const AUTH_ENDPOINT    = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT   = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT  = 'https://oauth2.googleapis.com/revoke'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo'

let _accessToken  = null
let _refreshToken = null
let _expiry       = 0
let _userInfo     = null
let _refreshTimer = null
let _refreshInFlight = false
let _sessionExpired  = false

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function _randomBase64url(byteLength) {
  const arr = new Uint8Array(byteLength)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function _sha256Base64url(str) {
  const bytes  = new TextEncoder().encode(str)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── Persistence ───────────────────────────────────────────────────────────────

function _persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token:  _accessToken,
    refresh_token: _refreshToken,
    expiry:        _expiry,
    userInfo:      _userInfo,
  }))
  localStorage.setItem(SESSION_KEY, '1')
}

function _loadStored() {
  // Remove old implicit-flow data if present
  localStorage.removeItem('yt_auth_v1')
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    _refreshToken = d.refresh_token ?? null
    _userInfo     = d.userInfo ?? null
    if (d.access_token && d.expiry > Date.now()) {
      _accessToken = d.access_token
      _expiry      = d.expiry
    }
    // If access token expired but refresh token exists → _doRefresh() will handle it
  } catch {}
}

// ── Token refresh ─────────────────────────────────────────────────────────────

function _scheduleRefresh(expiry) {
  if (_refreshTimer) clearTimeout(_refreshTimer)
  const ms = expiry - Date.now() - 5 * 60 * 1000 // 5 min before expiry
  _refreshTimer = setTimeout(_doRefresh, ms > 0 ? ms : 0)
}

async function _doRefresh() {
  if (_refreshInFlight) return
  if (!_refreshToken) return
  _refreshInFlight = true
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     import.meta.env.VITE_GOOGLE_CLIENT_ID,
        client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
        grant_type:    'refresh_token',
        refresh_token: _refreshToken,
      }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)

    _accessToken    = data.access_token
    _expiry         = Date.now() + data.expires_in * 1000
    _sessionExpired = false
    if (data.refresh_token) _refreshToken = data.refresh_token // Google may rotate it
    _persist()
    _scheduleRefresh(_expiry)
    document.dispatchEvent(new CustomEvent('auth-changed'))
  } catch (e) {
    console.warn('[auth] Token refresh failed:', e.message)
    _accessToken    = null
    _expiry         = 0
    _sessionExpired = true
    // Keep _refreshToken only if error is transient (network) — clear on invalid_grant
    if (e.message === 'invalid_grant' || e.message === 'token_revoked') {
      _refreshToken = null
      _userInfo = null
      localStorage.removeItem(STORAGE_KEY)
    }
    document.dispatchEvent(new CustomEvent('auth-changed', { detail: { sessionExpired: true } }))
  } finally {
    _refreshInFlight = false
  }
}

async function _fetchUserInfo(token) {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('userinfo failed')
  return res.json()
}

// ── OAuth callback handler ────────────────────────────────────────────────────

async function _handleCallback() {
  const url   = new URL(window.location.href)
  const code  = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (!code && !error) return false

  // Strip OAuth params from the URL immediately
  window.history.replaceState({}, '', window.location.origin + window.location.pathname)

  if (error) {
    console.warn('[auth] OAuth error:', error, url.searchParams.get('error_description'))
    return true
  }

  const verifier  = sessionStorage.getItem(PKCE_KEY)
  const returnHash = sessionStorage.getItem(RETURN_HASH_KEY) || '#/'
  sessionStorage.removeItem(PKCE_KEY)
  sessionStorage.removeItem(RETURN_HASH_KEY)

  if (!verifier) {
    console.warn('[auth] No PKCE verifier — possible CSRF or duplicate callback')
    return true
  }

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     import.meta.env.VITE_GOOGLE_CLIENT_ID,
        client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
        redirect_uri:  window.location.origin,
        grant_type:    'authorization_code',
        code_verifier: verifier,
      }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)

    _accessToken    = data.access_token
    _refreshToken   = data.refresh_token ?? null
    _expiry         = Date.now() + data.expires_in * 1000
    _sessionExpired = false

    try { _userInfo = await _fetchUserInfo(_accessToken) } catch {}
    _persist()
    _scheduleRefresh(_expiry)
    window.location.hash = returnHash
    document.dispatchEvent(new CustomEvent('auth-changed'))
  } catch (e) {
    console.error('[auth] Token exchange failed:', e.message)
  }
  return true
}

// ── Visibility change (PWA resume from background / Chromebook lid open) ──────

function _onVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  if (!_refreshToken) return
  const now = Date.now()
  if (!_accessToken || _expiry <= now || _expiry - now < 10 * 60 * 1000) {
    _doRefresh()
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function initAuth() {
  // Handle OAuth redirect callback before anything else
  const wasCallback = await _handleCallback()
  if (wasCallback) return

  _loadStored()

  if (_accessToken && _expiry > Date.now()) {
    _scheduleRefresh(_expiry)
  } else if (_refreshToken) {
    // Access token expired but we have a refresh token — renew silently.
    // Awaited so the router starts with correct auth state.
    await _doRefresh()
  } else if (localStorage.getItem(SESSION_KEY)) {
    // Had a session (old implicit-flow) but no refresh token → needs re-auth
    _sessionExpired = true
    _userInfo = null
    localStorage.removeItem(STORAGE_KEY)
  }

  document.addEventListener('visibilitychange', _onVisibilityChange)
}

export async function signIn() {
  const verifier  = _randomBase64url(64)
  const challenge = await _sha256Base64url(verifier)

  sessionStorage.setItem(PKCE_KEY, verifier)
  sessionStorage.setItem(RETURN_HASH_KEY, window.location.hash || '#/')

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri:          window.location.origin,
    scope:                 SCOPES,
    access_type:           'offline',
    prompt:                'consent',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `${AUTH_ENDPOINT}?${params}`
}

export function signOut() {
  if (_refreshTimer) clearTimeout(_refreshTimer)
  _refreshTimer    = null
  _refreshInFlight = false
  _sessionExpired  = false

  const tokenToRevoke = _accessToken || _refreshToken
  if (tokenToRevoke) {
    fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(tokenToRevoke)}`, { method: 'POST' })
      .catch(() => {})
  }

  _accessToken  = null
  _refreshToken = null
  _expiry       = 0
  _userInfo     = null
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(SESSION_KEY)
  document.dispatchEvent(new CustomEvent('auth-changed'))
}

export function getToken() {
  if (!_accessToken || _expiry <= Date.now()) return null
  return _accessToken
}

export function isAuthenticated() {
  return getToken() !== null
}

export function getUserInfo() {
  return _userInfo
}

export function isSessionExpired() {
  return _sessionExpired
}
