// Plain words for what the system calls things, and how each state is shown.
// A tone is one of: done, active, waiting, failed, closed. Only "failed" uses
// the signal colour; everything else is the one ink/accent family.

export const REQUEST_STATES = {
  PROPOSED: { label: 'Waiting for planner to confirm', tone: 'active' },
  CONTROLLER_REJECTED: { label: 'Rejected by controller', tone: 'failed' },
  RUNNING: { label: 'Re-running', tone: 'active' },
  AWAITING_SUBMISSION: { label: 'Planner reviewing', tone: 'active' },
  COVENANT_FAILED: { label: 'Covenant breach', tone: 'failed' },
  AWAITING_CONTROLLER: { label: 'Waiting for controller', tone: 'active' },
  AWAITING_CFO: { label: 'Waiting for CFO lock', tone: 'active' },
  PUBLISHING: { label: 'Publishing', tone: 'active' },
  PUBLISHED: { label: 'Published', tone: 'done' },
  CFO_REJECTED: { label: 'Not locked by CFO', tone: 'failed' },
  EXPIRED: { label: 'Expired, no decision', tone: 'closed' },
  CANCELLED: { label: 'Cancelled', tone: 'closed' },
  COMPENSATED: { label: 'Rolled back', tone: 'failed' },
  FAILED: { label: 'Failed', tone: 'failed' },
}

export const PLAN_STATES = {
  DRAFT: { label: 'Draft', tone: 'waiting' },
  IN_REVIEW: { label: 'In review', tone: 'active' },
  APPROVED: { label: 'Approved', tone: 'active' },
  LOCKED: { label: 'Locked', tone: 'done' },
  REJECTED: { label: 'Rejected', tone: 'failed' },
  SUPERSEDED: { label: 'Superseded', tone: 'closed' },
}

export const DRIVER_NAMES = {
  utilisation: 'Utilisation',
  bill_rate: 'Bill rate',
  attach_rate: 'Support attach rate',
  attrition: 'Attrition',
  rate_increase: 'Bill rate increase',
  realisation_factor: 'Realisation factor',
  customers: 'Active customers',
}

const COUNTRIES = {
  AE: 'UAE', AU: 'Australia', CA: 'Canada', DE: 'Germany', IN: 'India',
  PL: 'Poland', SG: 'Singapore', UK: 'United Kingdom', US: 'United States',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function requestState(state) {
  return REQUEST_STATES[state] || { label: state, tone: 'waiting' }
}

export function planState(state) {
  return PLAN_STATES[state] || { label: state, tone: 'waiting' }
}

export function driverName(code) {
  return DRIVER_NAMES[code] || String(code || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

// Values stored as fractions read as percentages when they are ratios
export function driverValue(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  return number > 0 && number <= 1 ? `${+(number * 100).toFixed(2)}%` : number.toLocaleString('en-US')
}

// Company codes carry their country (RTPL1 is Poland); a full country reads as its name
export function companiesLabel(companies) {
  if (!companies?.length) return 'All companies'
  const byCountry = {}
  for (const code of companies) {
    const country = code.slice(2, 4)
    ;(byCountry[country] ||= []).push(code)
  }
  return Object.entries(byCountry)
    .map(([country, codes]) => `${COUNTRIES[country] || country} (${codes.join(', ')})`)
    .join('; ')
}

export function monthsLabel(months) {
  if (!months?.length) return 'the whole year'
  const first = months[0]
  const last = months[months.length - 1]
  const name = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1]
  const year = first.slice(0, 4)
  return months.length === 1 ? `${name(first)} ${year}` : `${name(first)}–${name(last)} ${last.slice(0, 4)}`
}

export function shortTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// User ids are UUIDs; screens show names. Filled from GET /v1/people when
// someone signs in (UserPermissions.loadDirectory).
const directory = new Map()

export function setDirectory(people) {
  directory.clear()
  for (const { user_id: id, display_name: name } of people || []) directory.set(id, name)
}

export function personName(userId) {
  if (!userId) return ''
  // An id the directory has not caught up with (someone approved a minute
  // ago): a short form rather than a whole UUID
  return directory.get(userId) || `user ${String(userId).slice(0, 8)}`
}
