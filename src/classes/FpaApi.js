// Single service class for all HTTP calls. App.vue creates one instance and
// exposes it as this.$root.api.
//
// Every method is async and resolves to a normalized object (it never throws):
//   success: { error: false, status, data }
//   failure: { error: true,  status, message }
//
// The backend is the FastAPI app in fpa-project. Authentication is a bearer
// token: issued by sign-in or signup, or a seeded dev token pasted in. GET
// /v1/me says whose it is and what it can see. Scope is resolved from that
// token on the server for every request; nothing the browser sends can widen it.
export default class FpaApi {
  constructor() {
    this.urlBase = import.meta.env.VITE_API_BASE_URL || '/api/'
    // Set by UserPermissions, which owns where the token is kept
    this.token = null
  }

  setToken(token) {
    this.token = token || null
  }

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  // Resolves with data: { user_id, display_name, email, status, roles, companies, is_human }.
  // A PENDING account gets an answer here and nowhere else.
  getMe() {
    return this.request('v1/me')
  }

  // Resolves with data: [{ user_id, display_name }], every account
  getPeople() {
    return this.request('v1/people')
  }

  // Resolves with data: { user_id, status, token, expires_at }
  login(email, password) {
    return this.request('v1/auth/login', 'POST', { body: { email, password } })
  }

  // A new account starts PENDING; the token returned can only ask /v1/me
  signup(email, displayName, password) {
    return this.request('v1/auth/signup', 'POST', { body: { email, display_name: displayName, password } })
  }

  logout() {
    return this.request('v1/auth/logout', 'POST', { body: {} })
  }

  // ---------------------------------------------------------------------------
  // Accounts and access (superadmin only; the server and database enforce it)
  // ---------------------------------------------------------------------------

  listUsers() {
    return this.request('v1/admin/users')
  }

  // Resolves with data: { roles: [{ role_code, description, exclusive }], companies: [...] }
  getAccessCatalog() {
    return this.request('v1/admin/catalog')
  }

  approveUser(userId, { roles, companies, note }) {
    return this.request(`v1/admin/users/${encodeURIComponent(userId)}/approve`, 'POST', { body: { roles, companies, note } })
  }

  rejectUser(userId, note = '') {
    return this.request(`v1/admin/users/${encodeURIComponent(userId)}/reject`, 'POST', { body: { note } })
  }

  setUserAccess(userId, { roles, companies, note }) {
    return this.request(`v1/admin/users/${encodeURIComponent(userId)}/access`, 'PUT', { body: { roles, companies, note } })
  }

  renameUser(userId, displayName) {
    return this.request(`v1/admin/users/${encodeURIComponent(userId)}/name`, 'PUT', { body: { display_name: displayName } })
  }

  changeUserEmail(userId, email) {
    return this.request(`v1/admin/users/${encodeURIComponent(userId)}/email`, 'PUT', { body: { email } })
  }

  setUserEnabled(userId, enabled, note = '') {
    const action = enabled ? 'enable' : 'disable'
    return this.request(`v1/admin/users/${encodeURIComponent(userId)}/${action}`, 'POST', { body: { note } })
  }

  // Resolves with data: [{ id, configured }], one per model provider
  getProviders() {
    return this.request('v1/providers')
  }

  // ---------------------------------------------------------------------------
  // Read path
  // ---------------------------------------------------------------------------

  // companies narrows the caller's own scope; it can never widen it.
  askQuestion({ query, provider, companies }) {
    return this.request('v1/query', 'POST', {
      body: { query, provider, companies: companies && companies.length ? companies : null },
    })
  }

  // The signed-in person's own questions, newest first (no answers)
  listAskHistory(search = '') {
    return this.request('v1/ask-history', 'GET', { params: search ? { q: search } : null })
  }

  // One past question and the answer it got; the answer is withheld when it
  // was computed under companies the person can no longer see
  getAskHistory(askId) {
    return this.request(`v1/ask-history/${encodeURIComponent(askId)}`)
  }

  // dsl must end in COMPARE PLAN ... TO ACTUAL BRIDGE
  runBridge(dsl) {
    return this.request('v1/bridge', 'POST', { body: { dsl } })
  }

  // leg (price, volume, mix, fx, rate, efficiency) adds each row's
  // contribution to that leg, largest first
  getCitations(reportId, path, offset = 0, leg = null) {
    const params = { path, offset }
    if (leg) params.leg = leg
    return this.request(`v1/variance-reports/${encodeURIComponent(reportId)}/citations`, 'GET', { params })
  }

  // ---------------------------------------------------------------------------
  // Plan versions and governance
  // ---------------------------------------------------------------------------

  // Every plan version, oldest first, each with the code of the version it
  // re-forecasts (supersedes_plan_version_code) when it is a successor.
  listPlanVersions() {
    return this.request('v1/plan-versions')
  }

  // For a re-forecast successor: the shocks, the planner's reasons, and the
  // bridge from the baseline to this revision. Read-only.
  getPlanImpact(code, scenario = 'base') {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}/impact`, 'GET', {
      params: { scenario },
    })
  }

  getPlanVersion(code) {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}`)
  }

  // expectedVersion is the row_version last read: a stale one is refused, so
  // two people editing the same plan cannot silently overwrite each other.
  recordCovenant(code, { covenantOk, note, expectedVersion }) {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}/covenant`, 'PUT', {
      body: { covenant_ok: covenantOk, note, expected_version: expectedVersion },
    })
  }

  transitionPlan(code, { toState, note, expectedVersion }) {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}/transition`, 'POST', {
      body: { to_state: toState, note, expected_version: expectedVersion },
    })
  }

  // ---------------------------------------------------------------------------
  // Re-forecast (Temporal)
  // ---------------------------------------------------------------------------

  getProgress(code) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/progress`)
  }

  // The run's three human gates, in order: planner submits, controller
  // approves or rejects, CFO locks or declines. Each is refused unless the
  // run is parked at that gate.
  submitRun(code, { comment }) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/submit`, 'POST', { body: { comment } })
  }

  decideRun(code, { approved, comment }) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/decision`, 'POST', {
      body: { approved, comment },
    })
  }

  lockRun(code, { approved, comment }) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/lock`, 'POST', {
      body: { approved, comment },
    })
  }

  // A version's governed lines with their derivation traces, largest first
  getPlanLines(code, { limit = 50, offset = 0 } = {}) {
    return this.request(`v1/plan-versions/${encodeURIComponent(code)}/lines`, 'GET', { params: { limit, offset } })
  }

  cancelRun(code) {
    return this.request(`v1/reforecast/${encodeURIComponent(code)}/cancel`, 'POST')
  }

  // ---------------------------------------------------------------------------
  // Re-forecast requests: asked in words and confirmed by the planner
  // ---------------------------------------------------------------------------

  listReforecastRequests(state = null) {
    return this.request('v1/reforecast-requests', 'GET', { params: state ? { state } : null })
  }

  // The request, its evidence and every covenant check recorded for it
  getReforecastRequest(requestId) {
    return this.request(`v1/reforecast-requests/${encodeURIComponent(requestId)}`)
  }

  // The planner who asked: confirming starts the durable re-run, withdrawing closes it
  confirmReforecastRequest(requestId, { confirmed, comment }) {
    return this.request(`v1/reforecast-requests/${encodeURIComponent(requestId)}/confirm`, 'POST', {
      body: { confirmed, comment },
    })
  }

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  async request(endpoint, method = 'GET', { params = null, body = null } = {}) {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    const url = `${this.urlBase}${endpoint}${query}`

    let status = 0
    let json = {}
    try {
      const response = await fetch(url, this.prepareFetchInit(method, body))
      status = response.status
      json = await response.json().catch(() => ({}))
    } catch (err) {
      return { error: true, status, message: 'Server unavailable. Please try again.' }
    }

    if (status < 200 || status >= 300) {
      return { error: true, status, message: this.extractErrorMessage(json, status) }
    }
    return { error: false, status, data: json }
  }

  prepareFetchInit(method, body) {
    const headers = new Headers({ Accept: 'application/json' })
    if (this.token) {
      headers.append('Authorization', `Bearer ${this.token}`)
    }
    const init = { method, headers }
    if (body !== null) {
      headers.append('Content-Type', 'application/json')
      init.body = JSON.stringify(body)
    }
    return init
  }

  extractErrorMessage(json, status) {
    // FastAPI puts errors in "detail": a string, or a list of validation errors
    if (typeof json?.detail === 'string') return json.detail
    if (Array.isArray(json?.detail)) return json.detail.map((d) => d.msg).join('; ')
    if (json?.detail) return JSON.stringify(json.detail)
    if (status === 401 || status === 403) return 'That token is not accepted.'
    return json?.message || `Request failed (${status})`
  }
}
