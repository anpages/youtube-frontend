// Google Identity Services — Token (implicit) flow
// No backend required: access token obtained directly in the browser

const SCOPES = 'https://www.googleapis.com/auth/youtube openid profile email'
const STORAGE_KEY = 'yt_auth_v1'

let _tokenClient = null
let _silentClient = null
let _refreshTimer = null
let _token = null    // { access_token, expiry }
let _userInfo = null // { id, name, email, picture }

function _loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data.expiry > Date.now()) {
      _token = { access_token: data.access_token, expiry: data.expiry }
      _userInfo = data.userInfo ?? null
    } else {
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
}

function _scheduleRefresh(expiry) {
  if (_refreshTimer) clearTimeout(_refreshTimer)
  const msUntilExpiry = expiry - Date.now()
  const msUntilRefresh = msUntilExpiry - 5 * 60 * 1000 // 5 min before expiry
  if (msUntilRefresh <= 0) return
  _refreshTimer = setTimeout(_silentRefresh, msUntilRefresh)
}

function _silentRefresh() {
  if (!window.google?.accounts?.oauth2 || !import.meta.env.VITE_GOOGLE_CLIENT_ID) return
  if (!_silentClient) {
    _silentClient = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      prompt: '',
      callback: async (response) => {
        if (response.error || !response.access_token) return // silently fail
        _token = {
          access_token: response.access_token,
          expiry: Date.now() + response.expires_in * 1000,
        }
        _persist()
        _scheduleRefresh(_token.expiry)
        document.dispatchEvent(new CustomEvent('auth-changed'))
      },
    })
  }
  _silentClient.requestAccessToken({ prompt: '' })
}

export function initAuth() {
  _loadStored()
  if (_token) _scheduleRefresh(_token.expiry)
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
  _refreshTimer = null
  if (_token) {
    window.google.accounts.oauth2.revoke(_token.access_token, () => {})
  }
  _token = null
  _userInfo = null
  localStorage.removeItem(STORAGE_KEY)
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
