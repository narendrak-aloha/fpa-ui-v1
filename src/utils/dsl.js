// Plain-language helpers for FinOpsExpr and result rows.
//
// Ported from the reference page (fpa-project/templates/index.html) so the Vue
// app describes a query in exactly the same words. Pure functions, no Vue.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Words that read badly when a column name is split on underscores
const WORDS = { pct: '%', geo: '', yoy: 'year-on-year' }

export function niceName(name) {
  const words = String(name)
    .split('_')
    .map((word) => (word in WORDS ? WORDS[word] : word))
    .filter(Boolean)
  const joined = words.join(' ')
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

export function nicePeriod(period) {
  const p = period.trim()
  if (p.includes('..')) {
    const [from, to] = p.split('..')
    return `${nicePeriod(from)} to ${nicePeriod(to)}`
  }
  let match
  if ((match = p.match(/^(\d{4})-Q([1-4])$/))) {
    const quarter = Number(match[2])
    return `Q${quarter} ${match[1]} (${MONTHS[quarter * 3 - 3]}–${MONTHS[quarter * 3 - 1]})`
  }
  if ((match = p.match(/^(\d{4})-H([12])$/))) {
    return `${match[2] === '1' ? 'First' : 'Second'} half of ${match[1]}`
  }
  if ((match = p.match(/^(\d{4})-(\d{2})$/))) {
    return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`
  }
  if ((match = p.match(/^(\d{4})$/))) {
    return `Full year ${match[1]}`
  }
  return p
}

export function niceMeasure(measure) {
  let m = measure.trim()
  let match
  const alias = m.match(/\s+AS\s+(\w+)$/i)
  if (alias) m = m.slice(0, alias.index)
  if ((match = m.match(/^YOY\((.+)\)$/i))) return `${niceMeasure(match[1])}, change vs the year before`
  if ((match = m.match(/^PRIOR\((.+),\s*(\d+)\)$/i))) return `${niceMeasure(match[1])}, ${match[2]} period(s) earlier`
  if ((match = m.match(/^ROLLING\((.+),\s*(\d+)\)$/i))) return `${niceMeasure(match[1])}, rolling ${match[2]} periods`
  return niceName(m)
}

export function niceFilter(where) {
  return where
    .replace(/(\w+)\s+NOT IN\s*\(([^)]*)\)/gi, (_, dim, values) =>
      `${niceName(dim)} is not ${values.replace(/'/g, '').split(',').map((s) => s.trim()).join(', ')}`)
    .replace(/(\w+)\s+IN\s*\(([^)]*)\)/gi, (_, dim, values) =>
      `${niceName(dim)} is one of ${values.replace(/'/g, '').split(',').map((s) => s.trim()).join(', ')}`)
    .replace(/(\w+)\s*!=\s*'([^']*)'/g, (_, dim, value) => `${niceName(dim)} is not ${value}`)
    .replace(/(\w+)\s*=\s*'([^']*)'/g, (_, dim, value) => `${niceName(dim)} is ${value}`)
    .replace(/\bAND\b/g, 'and')
    .replace(/\bOR\b/g, 'or')
}

// Splits FinOpsExpr into its clauses and describes each one.
// Returns [[label, description], ...] in the order the clauses appear.
export function explainDsl(dsl) {
  const keys = ['SELECT', 'BY', 'WHERE', 'FOR PERIOD', 'AS OF', 'COMPARE PLAN', 'BRIDGE', 'LIMIT']
  const pattern = new RegExp(`\\b(${keys.join('|').replace(/ /g, '\\s+')})\\b`, 'g')
  // "GROUP BY" is not the BY clause
  const marks = [...dsl.matchAll(pattern)].filter(
    (mark) => !(mark[1] === 'BY' && /\bGROUP\s+$/.test(dsl.slice(0, mark.index))),
  )
  const parts = []
  marks.forEach((mark, index) => {
    const key = mark[1].replace(/\s+/g, ' ').toUpperCase()
    const end = index + 1 < marks.length ? marks[index + 1].index : dsl.length
    const body = dsl.slice(mark.index + mark[0].length, end).trim()
    if (key === 'SELECT') {
      parts.push(['Figures asked for', body.split(/,(?![^(]*\))/).map(niceMeasure).join('; ')])
    }
    if (key === 'BY') parts.push(['Broken down by', body.split(',').map(niceName).join(', ')])
    if (key === 'WHERE') parts.push(['Only where', niceFilter(body)])
    if (key === 'FOR PERIOD') parts.push(['Time period', nicePeriod(body)])
    if (key === 'AS OF') parts.push(['Books as they were on', body.replace(/'/g, '').replace('T', ' at ')])
    if (key === 'COMPARE PLAN') {
      const planVersion = (body.match(/pv\s*=\s*'([^']+)'/i) || [])[1]
      const scenario = (body.match(/scenario\s*=\s*'([^']+)'/i) || [])[1]
      parts.push(['Compared with', `Plan ${planVersion || ''}${scenario ? ` (${scenario} scenario)` : ''} against actual results`])
    }
    if (key === 'BRIDGE') parts.push(['Difference explained', 'Split into price and volume effects'])
    if (key === 'LIMIT') parts.push(['Rows shown', `At most ${body}`])
  })
  return parts
}

// Ratios stored as fractions read as percentages; everything else keeps the
// decimal places the column actually uses.
export function formatCell(column, value, decimals) {
  if (typeof value !== 'number') return value ?? ''
  if (/_pct$|pct$|utilisation|realisation/.test(column) && Math.abs(value) <= 10) {
    return `${(value * 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// How each execution_status is presented. `tone` drives the panel's colour.
export const OUTCOME = {
  SUCCESS: { tone: 'ok', title: '' },
  REFORECAST_PROPOSED: { tone: 'good', title: 'Re-forecast drafted. Confirm it to re-run the plan lines.' },
  OUT_OF_SCOPE: { tone: 'neutral', title: "This question isn't about the finance data." },
  // OUT_OF_SCOPE covers two unrelated refusals; refusal_reason says which.
  // Being refused a country is an access decision, not a remark about the
  // question, so it reads as one and carries the same weight as other refusals.
  'OUT_OF_SCOPE:COUNTRY_NOT_AUTHORIZED': { tone: 'bad', title: 'You are not authorized to view this country.' },
  REJECTED_SCOPE: { tone: 'bad', title: "You don't have access to all the data this question needs." },
  REFUSED: { tone: 'bad', title: 'The request was refused by a safety guardrail.' },
  VALIDATION_ERROR: { tone: 'bad', title: "The question couldn't be turned into a valid data request. Try rewording it." },
  REQUEST_ERROR: { tone: 'bad', title: 'Something went wrong while getting the answer.' },
}

export const PROVIDER_NAMES = {
  'claude-code': 'Claude (subscription)',
  codex: 'Codex (subscription)',
  'claude-api': 'Claude (API key)',
  gemini: 'Gemini (API key)',
}

export function describeDuration(ms) {
  if (ms == null) return null
  return ms < 1000 ? 'Under a second' : `${(ms / 1000).toFixed(1)} seconds`
}

// A long run of company codes (RTPL1, RTPL2, ...) reads as a count. The model
// writes the whole scope out, in brackets or not; four or more become "N companies".
export function compactCompanies(text) {
  return String(text || '')
    .replace(/\((?:\s*RT[A-Z]{2}\d+\s*,){3,}\s*RT[A-Z]{2}\d+\s*\)/g, (list) => `(${list.split(',').length} companies)`)
    .replace(/(?:\bRT[A-Z]{2}\d+,\s*){3,}RT[A-Z]{2}\d+\b/g, (list) => `${list.split(',').length} companies`)
}
