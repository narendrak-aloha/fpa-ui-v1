// Holds the signed-in human's session. App.vue creates one instance and
// exposes it as this.$root.user.
//
// Sign-in (email and password) or signup returns a session token; a seeded
// dev token can be pasted instead. Either way GET /v1/me says who that is.
// Roles and companies are kept for display only — the API re-resolves them
// from the token on every request, so nothing here is a permission.
//
// The token is kept in sessionStorage: it survives a refresh of this tab and
// is gone when the tab closes, so it is not left behind for the next person at
// this machine. Every storage access is guarded; without storage the session
// simply lasts as long as the page.
import { setDirectory } from '@/utils/labels'

const STORAGE_KEY = 'fpa-session-token'

function readStored() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(token) {
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, token)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the session lives in memory only
  }
}

export default class UserPermissions {
  token = null
  userId = null
  fullName = null
  email = null
  status = null
  roles = []
  companies = []

  constructor(api) {
    // api: the shared FpaApi instance
    this.api = api
    const stored = readStored()
    if (stored) {
      this.token = stored
      this.api.setToken(stored)
    }
  }

  // Resolves to { error: false } when the token is accepted, or
  // { error: true, message } when it is not. A rejected token is discarded.
  async authenticate(token) {
    const trimmed = (token || '').trim()
    if (!trimmed) {
      return { error: true, message: 'Enter your access token first.' }
    }
    this.api.setToken(trimmed)
    const response = await this.api.getMe()
    if (response.error) {
      this.clear()
      return response
    }
    this.token = trimmed
    writeStored(trimmed)
    this.setupUser(response.data)
    await this.loadDirectory()
    return response
  }

  // Names for the UUIDs screens show. A waiting account sees no one, and a
  // failure only means ids are shown shortened, so it is not an error.
  async loadDirectory() {
    if (this.status !== 'ACTIVE') return
    const response = await this.api.getPeople()
    if (!response.error) setDirectory(response.data)
  }

  async signIn(email, password) {
    const response = await this.api.login(email, password)
    if (response.error) return response
    return this.authenticate(response.data.token)
  }

  async signUp(email, displayName, password) {
    const response = await this.api.signup(email, displayName, password)
    if (response.error) return response
    return this.authenticate(response.data.token)
  }

  // Re-reads who this is: after approval a PENDING account becomes ACTIVE
  // with roles, and a superadmin's change lands on the next read.
  async refresh() {
    if (!this.token) return { error: true, message: 'Not signed in.' }
    const response = await this.api.getMe()
    if (!response.error) {
      this.setupUser(response.data)
      await this.loadDirectory()
    }
    return response
  }

  // data: the /v1/me response
  setupUser({ user_id, display_name, email, status, roles, companies }) {
    this.userId = user_id
    this.fullName = display_name
    this.email = email || null
    this.status = status || 'ACTIVE'
    this.roles = roles || []
    this.companies = companies || []
  }

  async logout() {
    // Revokes a signed-in session on the server; a pasted dev token has no
    // session, and forgetting it here ends it for this tab.
    if (this.token) await this.api.logout()
    this.clear()
  }

  isAuthenticated() {
    return this.token !== null
  }

  isLoaded() {
    return this.userId !== null
  }

  isPending() {
    return this.status === 'PENDING'
  }

  isSuperadmin() {
    return this.roles.includes('superadmin')
  }

  hasRole(role) {
    return this.roles.includes(role)
  }

  // The identity line the header shows, in the same shape as the reference page
  describe() {
    if (!this.isAuthenticated()) return ''
    return [this.fullName, this.roles.join(', '), this.companies.join(', ')]
      .filter(Boolean)
      .join(' · ')
  }

  clear() {
    this.token = null
    this.userId = null
    this.fullName = null
    this.email = null
    this.status = null
    this.roles = []
    this.companies = []
    this.api.setToken(null)
    writeStored(null)
  }
}
