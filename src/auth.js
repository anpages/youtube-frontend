// Google Identity Services — Token (implicit) flow
// No backend required: access token obtained directly in the browser

const SCOPES = 'https://www.googleapis.com/auth/youtube openid profile email'
const STORAGE_KEY = 'yt_auth_v1'
const SESSION_FLAG_KEY = 'yt_had_session'

let _tokenClient = null
let _silentClient = null
let _refreshTimer = null
let _expiryCleanupTimer = null
let _token = null    // { access_token, expiry }
let _userInfo = null // { id, name, email, picture }
let _refreshInFlight = false

function _loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.expiry > Date.now()) {
      _token = { access_token: data.access_token, expiry: data.expiry }
      _userInfo = data.userInfo ?? null
    } else {
      // Token expired — keep userInfo for optimistic UI while silent refresh runs
      _userInfo = data.userInfo ?? null
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {}
}

async function _fetchUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch user info')
  return res.json()
}

function _persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token: _token.access_token,
    expiry: _token.expiry,
    userInfo: _userInfo,
  }))
  localStorage.setItem(SESSION_FLAG_KEY, '1')
}

// Called when a refresh attempt fails and _token is still set (timer-based failure).
// Schedules a cleanup at the exact moment the token expires so the UI updates.
function _scheduleExpiryCleanup(expiry) {
  if (_expiryCleanupTimer) clearTimeout(_expiryCleanupTimer)
  const msUntilExpiry = expiry - Date.now()
  if (msUntilExpiry <= 0) {
    _clearAuthState()
    return
  }
  _expiryCleanupTimer = setTimeout(_clearAuthState, msUntilExpiry)
}

function _clearAuthState() {
  _token = null
  _userInfo = null
  localStorage.removeItem(STORAGE_KEY)
  document.dispatchEvent(new CustomEvent('auth-changed'))
}

function _scheduleRefresh(expiry) {
  if (_refreshTimer) clearTimeout(_refreshTimer)
  if (_expiryCleanupTimer) clearTimeout(_expiryCleanupTimer)
  const msUntilExpiry = expiry - Date.now()
  const msUntilRefresh = msUntilExpiry - 5 * 60 * 1000 // 5 min before expiry
  if (msUntilRefresh <= 0) {
    // Token expires in less than 5 minutes — refresh immediately
    _silentRefresh()
    return
  }
  _refreshTimer = setTimeout(_silentRefresh, msUntilRefresh)
}

function _silentRefresh() {
  if (_refreshInFlight) return
  if (!window.google?.accounts?.oauth2 || !import.meta.env.VITE_GOOGLE_CLIENT_ID) return
  _refreshInFlight = true

  // Always create a fresh client so the callback closure captures current state
  _silentClient = window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: SCOPES,
    prompt: '',
    callback: async (response) => {
      _refreshInFlight = false
      if (response.error || !response.access_token) {
        if (!_token) {
          // Startup silent refresh failed — no valid session to fall back to
          _userInfo = null
          document.dispatchEvent(new CustomEvent('auth-changed'))
        } else {
          // Timer-based refresh failed — token still valid for now.
          // Schedule cleanup for when it actually expires so the UI reacts.
          _scheduleExpiryCleanup(_token.expiry)
        }
        return
      }
      _token = {
        access_token: response.access_token,
        expiry: Date.now() + response.expires_in * 1000,
      }
      if (!_userInfo) {
        try { _userInfo = await _fetchUserInfo(response.access_token) } catch {}
      }
      _persist()
      _scheduleRefresh(_token.expiry)
      document.dispatchEvent(new CustomEvent('auth-changed'))
    },
  })
  _silentClient.requestAccessToken({ prompt: '' })
}

// Checks auth state when the app becomes visible again (resume from background/suspend).
function _onVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  if (!localStorage.getItem(SESSION_FLAG_KEY)) return

  const now = Date.now()
  if (!_token || _token.expiry <= now) {
    // Token missing or already expired — attempt silent refresh
    _silentRefresh()
  } else if (_token.expiry - now < 10 * 60 * 1000) {
    // Token expires in less than 10 minutes — refresh proactively
    _silentRefresh()
  }
}

export function initAuth() {
  _loadStored()
  if (_token) {
    _scheduleRefresh(_token.expiry)
  } else if (localStorage.getItem(SESSION_FLAG_KEY)) {
    // Token expired but user had a session — try silent refresh once GIS is ready
    const tryRefresh = () => {
      if (window.google?.accounts?.oauth2) {
        _silentRefresh()
      } else {
        // GIS script not ready yet, wait for it
        window.addEventListener('load', () => {
          if (window.google?.accounts?.oauth2) _silentRefresh()
        }, { once: true })
      }
    }
    tryRefresh()
  }

  // Refresh session whenever the app comes back to foreground (critical for PWA/suspend)
  document.addEventListener('visibilitychange', _onVisibilityChange)
}

export function signIn() {
  if (!window.google?.accounts?.oauth2) {
    alert('El servicio de Google aún no ha cargado. Espera un momento y vuelve a intentarlo.')
    return
  }
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    alert('Falta la variable de entorno VITE_GOOGLE_CLIENT_ID.')
    return
  }
  if (!_tokenClient) {
    _tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) {
          alert(`Error de autenticación: ${response.error}\n${response.error_description ?? ''}`)
          return
        }
        _token = {
          access_token: response.access_token,
          expiry: Date.now() + response.expires_in * 1000,
        }
        try {
          _userInfo = await _fetchUserInfo(response.access_token)
        } catch (e) {
          console.warn('Could not fetch user info:', e)
        }
        _persist()
        _scheduleRefresh(_token.expiry)
        document.dispatchEvent(new CustomEvent('auth-changed'))
      },
    })
  }
  _tokenClient.requestAccessToken()
}

export function signOut() {
  if (_refreshTimer) clearTimeout(_refreshTimer)
  if (_expiryCleanupTimer) clearTimeout(_expiryCleanupTimer)
  _refreshTimer = null
  _expiryCleanupTimer = null
  _refreshInFlight = false
  if (_token) {
    window.google.accounts.oauth2.revoke(_token.access_token, () => {})
  }
  _token = null
  _userInfo = null
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(SESSION_FLAG_KEY)
  document.dispatchEvent(new CustomEvent('auth-changed'))
}

export function getToken() {
  if (!_token || _token.expiry <= Date.now()) return null
  return _token.access_token
}

export function isAuthenticated() {
  return getToken() !== null
}

export function getUserInfo() {
  return _userInfo
}
