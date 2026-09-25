// Why an action is unavailable to the signed-in user, worked out in the
// browser so a button can say so before it is pressed.
//
// Every function returns '' when the action looks allowed, or a sentence a
// person can act on. None of this is a permission: the API, the workflow and
// the database still decide, and a refusal from them is shown as usual. These
// rules mirror the seeded governance store (plan_state_transition, the
// covenant field guard, the run approval activity); where the server knows
// better, it wins.

// Phases after which a run no longer takes a cancel: the publish has started
const PAST_CANCELLING = ['PUBLISHING', 'COMMITTING', 'COMPENSATING', 'VARIANCE', 'DONE', 'FAILED']

export const RUN_PHASES = [
  { phase: 'SNAPSHOT', label: 'Snapshot' },
  { phase: 'RESOLVING_DIRTY_SET', label: 'Dirty set' },
  { phase: 'RECOMPUTING', label: 'Recompute' },
  { phase: 'SAVING_DRAFT', label: 'Save draft' },
  { phase: 'AWAITING_SUBMISSION', label: 'Planner review' },
  { phase: 'COVENANT_CHECK', label: 'Covenants' },
  { phase: 'AWAITING_APPROVAL', label: 'Controller' },
  { phase: 'AWAITING_LOCK', label: 'CFO lock' },
  { phase: 'PUBLISHING', label: 'Publish' },
  { phase: 'COMMITTING', label: 'Commit' },
  { phase: 'VARIANCE', label: 'Variance' },
  { phase: 'DONE', label: 'Done' },
]

// Where the run parks for a person, in order: planner, controller, CFO
export const GATE_PHASES = ['AWAITING_SUBMISSION', 'AWAITING_APPROVAL', 'AWAITING_LOCK']

// DONE covers every ending (completed, rejected, expired, cancelled); FAILED
// is the one the workflow reports separately.
export function isFinished(phase) {
  return phase === 'DONE' || phase === 'FAILED'
}

function needsRole(user, roles) {
  if (roles.some((role) => user.hasRole(role))) return ''
  return `Needs the ${roles.join(' or ')} role`
}

function isRequester(user, requestedBy) {
  return Boolean(requestedBy) && user.userId === requestedBy
}

// plan.transitions is the server's list of { to_state, role_code } moves out
// of the current state; one target can appear once per role that may make it.
export function planTransitions(plan) {
  const byState = new Map()
  for (const { to_state: state, role_code: role } of plan?.transitions || []) {
    if (!byState.has(state)) byState.set(state, [])
    byState.get(state).push(role)
  }
  return [...byState].map(([state, roles]) => ({ state, roles }))
}

export function transitionBlocker(user, plan, { state, roles }) {
  // The API refuses these for a re-forecast: its run owns submit, approve and lock
  if (plan.supersedes_plan_version_id && state !== 'SUPERSEDED') {
    return 'A re-forecast is submitted, approved and locked from its row under its plan'
  }
  const missingRole = needsRole(user, roles)
  if (missingRole) return missingRole
  if (state === 'APPROVED') {
    if (isRequester(user, plan.requested_by)) {
      return 'You requested this plan, so someone else must approve it'
    }
    if (!plan.covenant_ok) return 'A controller must record a covenant pass first'
  }
  // The database allows LOCKED -> SUPERSEDED only once a locked re-forecast
  // of this plan exists; the button says so rather than failing on click
  if (state === 'SUPERSEDED' && plan.state === 'LOCKED'
      && !(plan.superseded_by || []).some((next) => next.state === 'LOCKED')) {
    return 'Only once a locked re-forecast replaces this plan'
  }
  return ''
}

export function covenantBlocker(user, plan, covenantOk) {
  if (!plan) return 'Load a plan first'
  if (plan.supersedes_plan_version_id) return "A re-forecast's covenants are checked by the system when it is submitted"
  const missingRole = needsRole(user, ['controller'])
  if (missingRole) return missingRole
  if (plan.state === 'LOCKED') return 'The plan is locked'
  if (plan.state === 'SUPERSEDED') return 'The plan has been replaced; it is history'
  if (!covenantOk && plan.state === 'APPROVED') {
    return 'An approved plan cannot carry a covenant breach'
  }
  return ''
}

export function cancelRunBlocker(progress) {
  if (!progress) return 'No run is going'
  if (progress.approval_state === 'CANCELLED') return 'Cancellation already sent'
  if (PAST_CANCELLING.includes(progress.phase)) return `Too late to cancel: the run is at ${progress.phase}`
  return ''
}

// Why this plan is waiting on this user, or '' when it is not. Advisory only:
// it sorts the plan list, and the buttons and the server still decide.
export function planAttention(user, plan) {
  // Re-forecast versions are decided in Re-forecast requests, not here
  if (plan.supersedes_plan_version_code) return ''
  const mine = isRequester(user, plan.requested_by)
  if (plan.state === 'IN_REVIEW' && !mine) {
    if (user.hasRole('controller') && !plan.covenant_ok) return 'Covenant review'
    if (user.hasRole('controller') || user.hasRole('cfo')) return 'Awaiting decision'
  }
  if (plan.state === 'APPROVED' && user.hasRole('cfo')) return 'Ready to lock'
  // A rejected version stays rejected: a new change is a new version
  if (plan.state === 'DRAFT' && mine) return 'Your draft'
  return ''
}

// -- Re-forecast requests (asked in words, confirmed by the planner) ---------

export const REQUEST_ACTIVE = ['RUNNING', 'AWAITING_SUBMISSION', 'AWAITING_CONTROLLER', 'AWAITING_CFO', 'PUBLISHING']

// The planner who asked confirms the agent's draft (starting the re-run) or withdraws it
export function requestConfirmBlocker(user, request) {
  if (!request) return 'Pick a request first'
  if (request.state !== 'PROPOSED') return `Already ${request.state.toLowerCase().replaceAll('_', ' ')}`
  if (!isRequester(user, request.requested_by)) return 'Only the planner who asked confirms it'
  return ''
}

// The planner submits the recomputed draft; the system then checks the covenants
export function requestSubmitBlocker(user, request) {
  if (!request) return 'Pick a request first'
  if (request.state !== 'AWAITING_SUBMISSION') return 'Only once the lines have been re-run'
  const missingRole = needsRole(user, ['planner'])
  if (missingRole) return missingRole
  return ''
}

// A controller approves (IN_REVIEW -> APPROVED) or rejects; approving neither locks nor publishes
export function requestControllerBlocker(user, request) {
  if (!request) return 'Pick a request first'
  if (request.state !== 'AWAITING_CONTROLLER') return 'Only after the draft is submitted and its covenants pass'
  const missingRole = needsRole(user, ['controller'])
  if (missingRole) return missingRole
  if (isRequester(user, request.requested_by)) return 'You asked for this re-forecast, so someone else must approve it'
  return ''
}

// The CFO locks the approved plan (APPROVED -> LOCKED); the system then publishes it
export function requestLockBlocker(user, request, approvedBy) {
  if (!request) return 'Pick a request first'
  if (request.state !== 'AWAITING_CFO') return 'Only after a controller approves it'
  const missingRole = needsRole(user, ['cfo'])
  if (missingRole) return missingRole
  if (isRequester(user, request.requested_by)) return 'You asked for this re-forecast, so someone else must lock it'
  if (approvedBy && user.userId === approvedBy) return 'You approved it, so someone else must lock it'
  return ''
}

export function requestAttention(user, request) {
  const mine = isRequester(user, request.requested_by)
  if (request.state === 'PROPOSED' && mine) return 'Confirm'
  if (request.state === 'AWAITING_SUBMISSION' && mine) return 'Review and submit'
  if (request.state === 'AWAITING_CONTROLLER' && user.hasRole('controller') && !mine) return 'Approve'
  if (request.state === 'AWAITING_CFO' && user.hasRole('cfo') && !mine) return 'Lock'
  return ''
}
