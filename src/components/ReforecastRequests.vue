<template>
  <!-- The re-forecasts of one plan, newest first, on a spine that runs down to
       the plan itself: the plan's version history. A re-forecast opens in
       place; one at a time. -->
  <section class="lineage" v-bind:aria-label="`Re-forecasts of ${planCode}`">
    <header class="lineage__head">
      <h3 class="text-lg font-semibold text-ink-main">Re-forecasts</h3>
      <div class="flex gap-2">
        <Button variant="ghost" v-bind:loading="busy === 'list'" v-on:click="loadList">Refresh</Button>
        <Button v-if="user.hasRole('planner')" variant="subtle" v-on:click="$emit('go-ask')">Ask for a re-forecast</Button>
      </div>
    </header>
    <ErrorMessage v-bind:message="listError" />

    <ol class="lineage__list">
      <li
        v-for="entry in entries"
        v-bind:key="entry.key"
        class="lineage__entry"
        v-bind:class="[`lineage__entry--${entry.node}`, { 'lineage__entry--open': entry.key === openKey }]"
      >
        <span class="lineage__node" aria-hidden="true"></span>
        <button
          type="button"
          class="lineage__row"
          v-bind:aria-expanded="entry.key === openKey"
          v-on:click="toggle(entry)"
        >
          <span class="lineage__main">
            <span class="lineage__title">
              <span v-if="entry.rev" class="lineage__rev">{{ entry.rev }}</span>{{ entry.title }}
            </span>
            <span class="lineage__sub">{{ entry.sub }}</span>
          </span>
          <span class="lineage__side">
            <span v-if="entry.attention" class="lineage__you">{{ entry.attention }}</span>
            <StatusPill v-bind="entry.pill" />
            <span class="lineage__chevron" aria-hidden="true">{{ entry.key === openKey ? '▾' : '▸' }}</span>
          </span>
        </button>

        <!-- A re-forecast asked for in words: its steps and the one that is open -->
        <div v-if="entry.key === openKey && entry.kind === 'request' && selected" class="lineage__detail">
          <p class="text-ink-mid">
            “{{ selected.question }}” asked by {{ personName(selected.requested_by) }} on {{ shortTime(selected.created_at) }}
          </p>
          <SignoffSlip v-model="step" v-bind:steps="steps" label="Steps of this re-forecast" />
          <div class="panel">
              <!-- Asked -->
              <template v-if="step === 'asked'">
                <h4 class="panel__title">What the planner asked for</h4>
                <p class="text-ink-mid">
                  Set {{ driverName(selected.driver_code).toLowerCase() }} from
                  {{ driverValue(selected.from_value) }} to {{ driverValue(selected.to_value) }} for
                  {{ sliceLabel(selected) }}. Nothing changes in the plan until the CFO locks it.
                </p>
                <p v-if="selected.evidence?.narrative" class="panel__quote">
                  {{ selected.evidence.narrative }}
                </p>
                <details v-if="selected.evidence?.dsl" class="text-sm">
                  <summary class="cursor-pointer text-ink-soft">The query behind the figures the planner saw</summary>
                  <pre class="mt-2 overflow-x-auto rounded-md bg-paper p-3 text-xs text-ink-main">{{ selected.evidence.dsl }}</pre>
                </details>
              </template>

              <!-- Confirmed: the planner checks the assistant understood -->
              <template v-else-if="step === 'confirmed'">
                <h4 class="panel__title">Planner: confirm the change the assistant drafted</h4>
                <template v-if="selected.state === 'PROPOSED'">
                  <p class="text-ink-mid">
                    Confirming re-runs the plan lines for this slice into a new draft version. Nothing is
                    approved yet: you review the new lines and submit them, the system checks the
                    covenants, a controller approves and the CFO locks.
                  </p>
                  <div class="max-w-lg">
                    <FormControl v-model="comment" label="Comment for the record (optional)" />
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <GuardedButton
                      variant="solid"
                      v-bind:blocker="confirmBlocker"
                      v-bind:loading="busy === 'confirm'"
                      v-on:click="confirm(true)"
                    >
                      Confirm and re-run
                    </GuardedButton>
                    <GuardedButton
                      v-bind:blocker="confirmBlocker"
                      v-bind:loading="busy === 'withdraw'"
                      v-on:click="confirm(false)"
                    >
                      Withdraw
                    </GuardedButton>
                  </div>
                  <p v-if="confirmBlocker" class="text-sm text-ink-soft">{{ confirmBlocker }}.</p>
                </template>
                <p v-else class="text-ink-mid">
                  {{ selected.run_id ? 'Confirmed' : 'Withdrawn' }} by {{ personName(selected.requested_by) }}.
                </p>
              </template>

              <!-- Recompute -->
              <template v-else-if="step === 'recompute'">
                <h4 class="panel__title">Re-run the plan lines</h4>
                <p v-if="!selected.run_id" class="text-ink-mid">Starts when the planner confirms.</p>
                <template v-else>
                  <p class="text-ink-mid">
                    Only the lines for {{ sliceLabel(selected) }} change. The rest of the plan is
                    left exactly as it is.
                  </p>
                  <RunTracker
                    v-if="progress"
                    v-bind:run-code="selected.plan_version_code"
                    v-bind:progress="progress"
                    v-bind:successor="{ covenant_ok: checksPassed, requested_by: selected.requested_by }"
                    v-bind:outcome="pill(selected.state).label"
                    v-bind:outcome-tone="pill(selected.state).tone"
                  />
                  <p v-else-if="!active" class="text-ink-mid">The re-run has finished.</p>
                  <GuardedButton
                    v-if="active"
                    v-bind:blocker="cancelBlocker"
                    v-bind:loading="busy === 'cancel'"
                    v-on:click="cancelRun"
                  >
                    Cancel this re-forecast
                  </GuardedButton>
                </template>
              </template>

              <!-- Review: the planner sees the recomputed lines before anything is approved -->
              <template v-else-if="step === 'review'">
                <h4 class="panel__title">Planner: review the recomputed lines and submit</h4>
                <p v-if="!targetCode" class="text-ink-mid">Once the lines have been re-run.</p>
                <template v-else>
                  <p class="text-ink-mid">
                    Draft {{ targetCode }}: the plan as it would be with this change. Submitting sends it to
                    the system's covenant check: a breach rejects it there and then; a pass puts it in
                    front of a controller.
                  </p>
                  <PlanLines v-bind:plan-code="targetCode" />
                  <template v-if="selected.state === 'AWAITING_SUBMISSION'">
                    <div class="max-w-lg">
                      <FormControl v-model="comment" label="Comment for the record (optional)" />
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <GuardedButton
                        variant="solid"
                        v-bind:blocker="submitBlocker"
                        v-bind:loading="busy === 'submit'"
                        v-on:click="submit"
                      >
                        Submit for review
                      </GuardedButton>
                      <GuardedButton
                        v-bind:blocker="cancelBlocker"
                        v-bind:loading="busy === 'cancel'"
                        v-on:click="cancelRun"
                      >
                        Discard this draft
                      </GuardedButton>
                    </div>
                    <p v-if="submitBlocker" class="text-sm text-ink-soft">{{ submitBlocker }}.</p>
                  </template>
                </template>
              </template>

              <!-- Covenants -->
              <template v-else-if="step === 'covenants'">
                <h4 class="panel__title">Covenant check, by the system</h4>
                <p v-if="!checks.length" class="text-ink-mid">
                  {{ active ? 'Runs when the planner submits the draft. Nobody records this verdict by hand.' : 'No covenant check was recorded.' }}
                </p>
                <template v-else>
                  <p class="text-ink-mid">
                    Each rule is measured on {{ sliceLabel(selected) }}, in every scenario.
                    {{ checksPassed ? 'Every rule passed, so the draft went to a controller.' : 'A rule failed, so the submitted draft was rejected before any controller saw it: nothing was approved, published or committed.' }}
                  </p>
                  <div class="overflow-x-auto">
                    <table class="covenants">
                      <thead>
                        <tr>
                          <th>Rule</th>
                          <th>Limit</th>
                          <th v-for="scenario in scenarios" v-bind:key="scenario" class="covenants__num">
                            {{ scenarioName(scenario) }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="rule in ruleRows" v-bind:key="rule.code">
                          <th scope="row">
                            <span class="block font-medium text-ink-main">{{ rule.name }}</span>
                            <span class="block text-xs font-normal text-ink-soft">{{ rule.description }}</span>
                          </th>
                          <td class="whitespace-nowrap text-ink-mid">{{ rule.limit }}</td>
                          <td
                            v-for="scenario in scenarios"
                            v-bind:key="scenario"
                            class="text-right"
                            v-bind:title="rule.cells[scenario]?.title"
                          >
                            <span
                              v-if="rule.cells[scenario]"
                              class="covenants__cell"
                              v-bind:class="rule.cells[scenario].passed ? 'covenants__cell--pass' : 'covenants__cell--fail'"
                            >
                              {{ rule.cells[scenario].value }}
                              <span aria-hidden="true">{{ rule.cells[scenario].passed ? '✓' : '✕' }}</span>
                              <span class="sr-only">{{ rule.cells[scenario].passed ? 'passed' : 'failed' }}</span>
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
              </template>

              <!-- Controller: approve or reject the submitted plan -->
              <template v-else-if="step === 'controller'">
                <h4 class="panel__title">Controller: approve or reject</h4>
                <p v-if="!checksPassed" class="text-ink-mid">
                  {{ selected.state === 'COVENANT_FAILED' ? 'Not reached: the covenant check rejected the submitted draft.' : 'Comes after the planner submits and the covenants pass.' }}
                </p>
                <template v-else>
                  <p class="text-ink-mid">
                    What this re-forecast does to the plan, measured from the original plan. Approving
                    neither locks nor publishes it: the CFO locks it next.
                  </p>
                  <ReforecastImpact v-bind:plan-code="targetCode" v-bind:refresh-key="selected.state" />
                  <details class="text-sm">
                    <summary class="cursor-pointer text-ink-soft">The recomputed lines and how each was derived</summary>
                    <div class="mt-2"><PlanLines v-bind:plan-code="targetCode" /></div>
                  </details>
                  <template v-if="selected.state === 'AWAITING_CONTROLLER'">
                    <div class="max-w-lg">
                      <FormControl v-model="comment" label="Comment for the record (optional)" />
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <GuardedButton
                        variant="solid"
                        v-bind:blocker="controllerBlocker"
                        v-bind:loading="busy === 'approve'"
                        v-on:click="decideRun(true)"
                      >
                        Approve
                      </GuardedButton>
                      <GuardedButton
                        v-bind:blocker="controllerBlocker"
                        v-bind:loading="busy === 'reject'"
                        v-on:click="decideRun(false)"
                      >
                        Reject
                      </GuardedButton>
                    </div>
                    <p v-if="controllerBlocker" class="text-sm text-ink-soft">{{ controllerBlocker }}.</p>
                  </template>
                  <p v-else-if="successor?.approved_by" class="text-ink-mid">
                    Approved by {{ personName(successor.approved_by) }}.
                  </p>
                  <p v-if="progress?.refusals?.length" class="text-sm text-signal" role="alert">
                    Refused: {{ progress.refusals[progress.refusals.length - 1] }}
                  </p>
                </template>
              </template>

              <!-- CFO: lock the approved plan; the system publishes it -->
              <template v-else-if="step === 'cfo'">
                <h4 class="panel__title">CFO: lock</h4>
                <p v-if="!successor?.approved_by" class="text-ink-mid">Comes after a controller approves it.</p>
                <template v-else>
                  <p class="text-ink-mid">
                    Approved by {{ personName(successor.approved_by) }}; covenants
                    {{ checksPassed ? 'passed' : 'not passed' }}. Locking makes {{ targetCode }} final and
                    unchangeable; the system then publishes it and reserves the budget.
                  </p>
                  <ReforecastImpact v-bind:plan-code="targetCode" v-bind:refresh-key="selected.state" />
                  <template v-if="selected.state === 'AWAITING_CFO'">
                    <div class="max-w-lg">
                      <FormControl v-model="comment" label="Comment for the record (optional)" />
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <GuardedButton
                        variant="solid"
                        v-bind:blocker="lockBlocker"
                        v-bind:loading="busy === 'lock'"
                        v-on:click="lockRun(true)"
                      >
                        Lock
                      </GuardedButton>
                      <GuardedButton
                        v-bind:blocker="lockBlocker"
                        v-bind:loading="busy === 'decline'"
                        v-on:click="lockRun(false)"
                      >
                        Do not lock
                      </GuardedButton>
                    </div>
                    <p v-if="lockBlocker" class="text-sm text-ink-soft">{{ lockBlocker }}.</p>
                  </template>
                  <p v-if="progress?.refusals?.length" class="text-sm text-signal" role="alert">
                    Refused: {{ progress.refusals[progress.refusals.length - 1] }}
                  </p>
                </template>
              </template>

              <!-- Published -->
              <template v-else>
                <h4 class="panel__title">Published</h4>
                <p class="text-ink-mid">{{ outcomeSentence }}</p>
                <p v-if="selected.outcome_detail && !active" class="text-sm text-ink-soft">
                  Recorded: {{ withNames(selected.outcome_detail) }}
                </p>
              </template>
          </div>
          <div v-if="actionStatus || errorMessage" class="space-y-1">
            <ErrorMessage v-bind:message="errorMessage" />
            <p v-if="actionStatus" class="text-sm text-ink-mid">{{ actionStatus }}</p>
          </div>
        </div>

        <!-- A version changed straight from the API, with no request behind it -->
        <div v-else-if="entry.key === openKey && entry.kind === 'version'" class="lineage__detail">
          <p class="text-ink-mid">
            {{ entry.version.plan_version_code }} was changed directly through the API (<code>make reforecast</code>),
            not asked for in words, so it has no request here. It is {{ entry.pill.label.toLowerCase() }}.
          </p>
        </div>
      </li>

      <!-- The foot of the spine: the plan every re-forecast above starts from -->
      <li class="lineage__entry lineage__entry--origin">
        <span class="lineage__node" aria-hidden="true"></span>
        <p class="lineage__origin">
          <span class="font-medium text-ink-main">{{ planCode }}</span>
          <span class="text-ink-soft"> the agreed plan these re-forecasts start from</span>
        </p>
      </li>
    </ol>

    <p v-if="!entries.length && !listError" class="text-sm text-ink-soft">
      No re-forecasts of this plan yet.
      {{ user.hasRole('planner') ? 'Ask for one in plain words on the Ask tab.' : 'A planner asks for one on the Ask tab.' }}
    </p>
  </section>
</template>

<script>
import { Button, ErrorMessage, FormControl } from 'frappe-ui'
import GuardedButton from '@/components/GuardedButton.vue'
import PlanLines from '@/components/PlanLines.vue'
import ReforecastImpact from '@/components/ReforecastImpact.vue'
import RunTracker from '@/components/RunTracker.vue'
import SignoffSlip from '@/components/SignoffSlip.vue'
import StatusPill from '@/components/StatusPill.vue'
import {
  companiesLabel,
  driverName,
  driverValue,
  monthsLabel,
  personName,
  planState,
  requestState,
  shortTime,
} from '@/utils/labels'
import {
  REQUEST_ACTIVE,
  cancelRunBlocker,
  requestAttention,
  requestConfirmBlocker,
  requestControllerBlocker,
  requestLockBlocker,
  requestSubmitBlocker,
} from '@/utils/workflowRules'

const RULE_NAMES = {
  GM_PCT_FLOOR: 'Gross margin',
  REVENUE_DROP_LIMIT: 'Revenue drop',
  DELIVERY_COST_CEILING: 'Delivery cost rise',
}

export default {
  name: 'ReforecastRequests',

  components: { Button, ErrorMessage, FormControl, GuardedButton, PlanLines, ReforecastImpact, RunTracker, SignoffSlip, StatusPill },

  props: {
    // The agreed plan whose re-forecasts are shown
    planCode: { type: String, required: true },
    // Its re-forecast versions (list rows), for version codes and API-only changes
    versions: { type: Array, default: () => [] },
    // The version whose numbers are live now, marked on the spine
    liveVersion: { type: String, default: '' },
    // Set by the page when the planner's question just produced a request
    focusId: { type: String, default: '' },
  },

  // changed: a request's state moved, so the plan can re-read its versions
  // attention: how many requests wait on this user, for the tab count
  // go-ask: to the Ask tab
  // focus-plan: the request to open belongs to another plan; the page opens that plan
  emits: ['changed', 'attention', 'go-ask', 'focus-plan'],

  data() {
    return {
      requests: [],
      listError: '',
      selectedId: '',
      selected: null,
      // The open entry on the spine: `req-<id>` or `ver-<code>`
      openKey: '',
      step: 'asked',
      progress: null,
      // describe() of the draft version this re-forecast recomputed into
      successor: null,
      comment: '',
      busy: '',
      actionStatus: '',
      errorMessage: '',
      pollTimer: null,
      scenarios: ['base', 'stretch', 'downside'],
    }
  },

  computed: {
    user() {
      return this.$root.user
    },

    // The spine, newest first: every request on this plan, and any version of
    // it changed straight from the API with no request behind it
    entries() {
      const requests = this.requests.filter((request) => request.plan_version_code === this.planCode)
      const asked = new Set(requests.map((request) => request.version_code).filter(Boolean))
      const rows = requests.map((request) => ({
        kind: 'request',
        key: `req-${request.request_id}`,
        id: request.request_id,
        at: String(request.created_at),
        rev: this.rev(request.version_code),
        title: this.changeLabel(request),
        sub: this.sliceLabel(request),
        pill: this.entryPill(requestState(request.state), request.state === 'PUBLISHED', request.version_code),
        attention: this.attention(request),
        node: this.node(request.state, request.version_code),
      }))
      for (const version of this.versions) {
        if (asked.has(version.plan_version_code)) continue
        rows.push({
          kind: 'version',
          key: `ver-${version.plan_version_code}`,
          version,
          at: String(version.created_at),
          rev: this.rev(version.plan_version_code),
          title: 'Changed directly',
          sub: 'Through the API, with no request asked in words',
          pill: this.entryPill(planState(version.state), ['LOCKED', 'SUPERSEDED'].includes(version.state), version.plan_version_code),
          attention: '',
          node: version.plan_version_code === this.liveVersion ? 'live' : version.state === 'REJECTED' ? 'failed' : 'closed',
        })
      }
      return rows.sort((a, b) => b.at.localeCompare(a.at))
    },

    needingMe() {
      return this.requests.filter((request) => this.attention(request)).length
    },

    checks() {
      return this.selected?.covenant_checks || []
    },

    checksPassed() {
      return this.checks.length > 0 && this.checks.every((check) => check.passed)
    },

    active() {
      return REQUEST_ACTIVE.includes(this.selected?.state)
    },

    targetCode() {
      return this.selected?.target_version_code || this.progress?.target_version_code || this.successor?.plan_version_code || ''
    },

    confirmBlocker() {
      return requestConfirmBlocker(this.user, this.selected)
    },

    submitBlocker() {
      return requestSubmitBlocker(this.user, this.selected)
    },

    controllerBlocker() {
      return requestControllerBlocker(this.user, this.selected)
    },

    lockBlocker() {
      return requestLockBlocker(this.user, this.selected, this.successor?.approved_by)
    },

    cancelBlocker() {
      if (!['planner', 'controller', 'cfo'].some((role) => this.user.hasRole(role))) {
        return 'Needs the planner, controller or CFO role'
      }
      return cancelRunBlocker(this.progress)
    },

    // One row per rule, one cell per scenario
    ruleRows() {
      const rows = new Map()
      for (const check of this.checks) {
        if (!rows.has(check.rule_code)) {
          rows.set(check.rule_code, {
            code: check.rule_code,
            name: RULE_NAMES[check.rule_code] || check.rule_code,
            description: check.description,
            limit: `${check.comparator === '>=' ? 'at least' : 'at most'} ${this.measure(check.threshold, check)}`,
            cells: {},
          })
        }
        rows.get(check.rule_code).cells[check.scenario_code] = {
          passed: check.passed,
          value: this.measure(check.measured_value, check),
          title: `Before ${this.number(check.before_value)}, after ${this.number(check.after_value)}`,
        }
      }
      return [...rows.values()]
    },

    steps() {
      const r = this.selected
      if (!r) return []
      const s = r.state
      const checks = this.checks
      const failedChecks = checks.filter((check) => !check.passed).length
      const mine = r.requested_by === this.user.userId
      const approvedBy = this.successor?.approved_by
      const turn = (role, own = false) =>
        (own ? mine : this.user.hasRole(role) && !mine) ? 'Your turn' : `Waiting for the ${role === 'cfo' ? 'CFO' : role}`
      // Where a run that stopped early stopped: from what it recorded
      const ended = ['EXPIRED', 'CANCELLED', 'FAILED'].includes(s)
      const endStamp = { EXPIRED: 'No decision in time', CANCELLED: 'Cancelled', FAILED: 'Failed' }[s]
      const stoppedAt = !ended ? ''
        : !r.run_id ? 'confirmed'
          : !checks.length ? (s === 'FAILED' && !this.successor ? 'recompute' : 'review')
            : failedChecks ? 'covenants'
              : approvedBy ? 'cfo' : 'controller'
      const ORDER = ['asked', 'confirmed', 'recompute', 'review', 'covenants', 'controller', 'cfo', 'published']
      const after = (key) => ended && ORDER.indexOf(key) > ORDER.indexOf(stoppedAt)
      const pick = (key, value) => (stoppedAt === key ? { state: 'failed', stamp: endStamp } : after(key) ? { state: 'skipped' } : value)

      const confirmed = pick('confirmed',
        s === 'PROPOSED' ? { state: 'current', stamp: turn('planner', true) }
          : { state: 'signed', stamp: personName(r.requested_by) })

      const recompute = pick('recompute',
        s === 'PROPOSED' ? { state: 'pending' }
          : s === 'RUNNING' ? { state: 'current', stamp: this.progressStamp }
            : { state: 'signed', stamp: 'Done' })

      const review = pick('review',
        ['PROPOSED', 'RUNNING'].includes(s) ? { state: 'pending' }
          : s === 'AWAITING_SUBMISSION' ? { state: 'current', stamp: turn('planner', true) }
            : { state: 'signed', stamp: 'Submitted' })

      const covenants = pick('covenants',
        checks.length
          ? (failedChecks ? { state: 'failed', stamp: `${failedChecks} of ${checks.length} failed` } : { state: 'signed', stamp: `All ${checks.length} passed` })
          : { state: 'pending' })

      const controller = pick('controller',
        s === 'COVENANT_FAILED' ? { state: 'skipped' }
          : s === 'AWAITING_CONTROLLER' ? { state: 'current', stamp: turn('controller') }
            : s === 'CONTROLLER_REJECTED' ? { state: 'failed', stamp: 'Rejected' }
              : approvedBy ? { state: 'signed', stamp: personName(approvedBy) }
                : { state: 'pending' })

      const cfo = pick('cfo',
        ['COVENANT_FAILED', 'CONTROLLER_REJECTED'].includes(s) ? { state: 'skipped' }
          : s === 'AWAITING_CFO' ? { state: 'current', stamp: turn('cfo') }
            : s === 'CFO_REJECTED' ? { state: 'failed', stamp: 'Not locked' }
              : ['PUBLISHING', 'PUBLISHED', 'COMPENSATED'].includes(s) ? { state: 'signed', stamp: 'Locked' }
                : { state: 'pending' })

      const published = pick('published',
        s === 'PUBLISHED' ? { state: 'signed', stamp: 'Live, budget reserved' }
          : s === 'PUBLISHING' ? { state: 'current', stamp: 'Publishing now' }
            : s === 'COMPENSATED' ? { state: 'failed', stamp: 'Rolled back' }
              : REQUEST_ACTIVE.includes(s) || s === 'PROPOSED' ? { state: 'pending' } : { state: 'skipped' })

      return [
        { key: 'asked', phase: 'Prepare', title: 'Asked', who: 'Planner', state: 'signed', stamp: `${personName(r.requested_by)}, ${shortTime(r.created_at)}` },
        { key: 'confirmed', phase: 'Prepare', title: 'Confirmed', who: 'Planner', ...confirmed },
        { key: 'recompute', phase: 'Prepare', title: 'Re-run', who: 'System', ...recompute },
        { key: 'review', phase: 'Review', title: 'Submitted', who: 'Planner', ...review },
        { key: 'covenants', phase: 'Review', title: 'Covenants', who: 'System', ...covenants },
        { key: 'controller', phase: 'Sign-off', title: 'Approved', who: 'Controller', ...controller },
        { key: 'cfo', phase: 'Sign-off', title: 'Locked', who: 'CFO', ...cfo },
        { key: 'published', phase: 'Sign-off', title: 'Published', who: 'System', ...published },
      ]
    },

    progressStamp() {
      const p = this.progress
      if (!p?.dirty_rows) return 'Working'
      return `${Math.min(100, Math.round((p.processed_rows / p.dirty_rows) * 100))}% done`
    },

    outcomeSentence() {
      const s = this.selected?.state
      return {
        PUBLISHED: 'The new numbers are live in the plan and the budget is reserved with the commitment service.',
        PUBLISHING: 'Publishing to the plan and reserving the budget now.',
        COMPENSATED: 'Publishing started, but reserving the budget failed, so the plan was put back exactly as it was.',
        FAILED: 'The re-forecast stopped with an error. Nothing was left half-done.',
      }[s] || 'Not published. Nothing in the plan or the budget changed.'
    },
  },

  watch: {
    focusId: {
      immediate: true,
      handler(id) {
        if (!id) return
        this.loadList().then(() => {
          const row = this.requests.find((request) => request.request_id === id)
          // Another plan's request: the page opens that plan, which mounts this
          // list again with the same focus
          if (row && row.plan_version_code !== this.planCode) this.$emit('focus-plan', row.plan_version_code)
          else this.select(id)
        })
      },
    },

    planCode() {
      this.close()
    },

    needingMe: {
      immediate: true,
      handler(count) {
        this.$emit('attention', count)
      },
    },
  },

  mounted() {
    this.loadList()
  },

  beforeUnmount() {
    clearTimeout(this.pollTimer)
  },

  methods: {
    shortTime,
    personName,
    driverName,
    driverValue,

    // User ids in a recorded detail read as names
    withNames(text) {
      return String(text || '').replace(/\b[0-9a-f]{32}\b/g, (id) => personName(id))
    },

    attention(request) {
      return requestAttention(this.user, request)
    },

    pill(state) {
      return requestState(state)
    },

    changeLabel(request) {
      return `${driverName(request.driver_code)} ${driverValue(request.from_value)} → ${driverValue(request.to_value)}`
    },

    sliceLabel(request) {
      return `${companiesLabel(request.companies)}, ${monthsLabel(request.period_months)}`
    },

    scenarioName(code) {
      return code.charAt(0).toUpperCase() + code.slice(1)
    },

    number(value) {
      if (value === null || value === undefined) return '—'
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
    },

    measure(value, check) {
      if (value === null || value === undefined) return '—'
      const percent = check.measure === 'CHANGE_PCT' || check.metric === 'gross_margin_pct'
      const number = Number(value).toLocaleString('en-US', { maximumFractionDigits: percent ? 1 : 0 })
      return percent ? `${number}%` : number
    },

    // The step worth looking at first: whatever waits or failed, else the last one signed
    focusStep() {
      const open = this.steps.find((step) => step.state === 'current' || step.state === 'failed')
      const signed = this.steps.filter((step) => step.state === 'signed')
      this.step = open?.key || signed[signed.length - 1]?.key || 'asked'
    },

    async loadList() {
      this.busy = 'list'
      const response = await this.$root.callAuthenticatedEndpoint('listReforecastRequests')
      if (this.busy === 'list') this.busy = ''
      this.listError = response.error ? response.message : ''
      if (!response.error) this.requests = response.data
    },

    toggle(entry) {
      if (this.openKey === entry.key) return this.close()
      if (entry.kind === 'request') return this.select(entry.id)
      this.close()
      this.openKey = entry.key
    },

    close() {
      clearTimeout(this.pollTimer)
      this.openKey = ''
      this.selectedId = ''
      this.selected = null
      this.progress = null
      this.successor = null
    },

    // R5 from PV-2026-0001-R5
    rev(code) {
      return code ? code.slice(code.lastIndexOf('-') + 1) : ''
    },

    // Green means live now: a published version a later one replaced reads as replaced
    entryPill(pill, published, code) {
      if (!published) return pill
      return code && code === this.liveVersion ? { label: 'Live', tone: 'done' } : { label: 'Replaced', tone: 'closed' }
    },

    // How a request's node on the spine is drawn
    node(state, versionCode) {
      if (versionCode && versionCode === this.liveVersion) return 'live'
      if (['COVENANT_FAILED', 'CONTROLLER_REJECTED', 'CFO_REJECTED', 'COMPENSATED', 'FAILED'].includes(state)) return 'failed'
      if (state === 'PROPOSED' || REQUEST_ACTIVE.includes(state)) return 'active'
      return 'closed'
    },

    async select(id) {
      this.openKey = `req-${id}`
      this.selectedId = id
      this.comment = ''
      this.actionStatus = ''
      this.errorMessage = ''
      this.progress = null
      this.successor = null
      this.selected = null
      await this.refreshSelected()
      this.focusStep()
    },

    // Re-reads the request (its state mirrors the run) and the live progress,
    // polling for as long as the run is going.
    async refreshSelected() {
      clearTimeout(this.pollTimer)
      const id = this.selectedId
      if (!id) return
      const response = await this.$root.callAuthenticatedEndpoint('getReforecastRequest', id)
      if (id !== this.selectedId) return
      if (response.error) {
        this.errorMessage = response.message
        return
      }
      const before = this.selected?.request_id === id ? this.selected.state : null
      this.selected = response.data
      const row = this.requests.find((request) => request.request_id === id)
      if (row) Object.assign(row, { state: response.data.state })
      if (before && before !== response.data.state) {
        // The list's row (its version, its pill) and the plan's versions move with it
        this.$emit('changed')
        this.loadList()
        this.focusStep()
      }
      if (this.active) {
        const progress = await this.$root.callAuthenticatedEndpoint('getProgress', this.selected.plan_version_code)
        if (id !== this.selectedId) return
        this.progress = progress.error ? null : progress.data
        this.pollTimer = setTimeout(() => this.refreshSelected(), this.$root.config.PROGRESS_POLL_INTERVAL)
      } else {
        this.progress = null
      }
      // The draft version: who approved it, for the lock step
      const target = this.targetCode
      if (target) {
        const version = await this.$root.callAuthenticatedEndpoint('getPlanVersion', target)
        if (id !== this.selectedId) return
        this.successor = version.error ? null : version.data
      } else {
        this.successor = null
      }
    },

    async act(busy, endpoint, args, status) {
      this.busy = busy
      this.errorMessage = ''
      const response = await this.$root.callAuthenticatedEndpoint(endpoint, ...args)
      this.busy = ''
      if (response.error) {
        this.errorMessage = response.message
        return false
      }
      this.comment = ''
      this.actionStatus = status
      await this.refreshSelected()
      setTimeout(() => this.loadList(), this.$root.config.PROGRESS_POLL_INTERVAL * 2)
      return true
    },

    async confirm(confirmed) {
      const done = await this.act(confirmed ? 'confirm' : 'withdraw', 'confirmReforecastRequest',
        [this.selectedId, { confirmed, comment: this.comment }],
        confirmed ? 'Confirmed. The plan lines are being re-run into a new draft for you to review.' : 'Withdrawn. The request is closed.')
      if (done) {
        await this.loadList()
        this.focusStep()
      }
    },

    submit() {
      return this.act('submit', 'submitRun', [this.selected.plan_version_code, { comment: this.comment }],
        'Submitted. The system is checking the covenants: a breach rejects the draft, a pass sends it to a controller.')
    },

    // The controller's gate: approve (IN_REVIEW -> APPROVED) or reject
    decideRun(approved) {
      return this.act(approved ? 'approve' : 'reject', 'decideRun',
        [this.selected.plan_version_code, { approved, comment: this.comment }],
        approved ? 'Approved. It now waits for the CFO to lock it; nothing is published yet.' : 'Rejected. Nothing is published.')
    },

    // The CFO's gate: lock (APPROVED -> LOCKED, then the system publishes) or decline
    lockRun(approved) {
      return this.act(approved ? 'lock' : 'decline', 'lockRun',
        [this.selected.plan_version_code, { approved, comment: this.comment }],
        approved ? 'Locked. The system is publishing it and reserving the budget.' : 'Not locked. Nothing is published.')
    },

    async cancelRun() {
      this.busy = 'cancel'
      this.errorMessage = ''
      const response = await this.$root.callAuthenticatedEndpoint('cancelRun', this.selected.plan_version_code)
      this.busy = ''
      if (response.error) {
        this.errorMessage = response.message
        return
      }
      this.actionStatus = 'Cancelling. Nothing is published or committed.'
      await this.refreshSelected()
    },
  },
}
</script>

<style scoped>
.lineage {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.lineage__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

/* The spine: one line down the left, from the newest re-forecast to the plan */
.lineage__list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.lineage__list::before {
  content: '';
  position: absolute;
  left: 0.6875rem;
  top: 1.25rem;
  bottom: 1rem;
  width: 2px;
  background: var(--line);
}
.lineage__entry {
  position: relative;
  padding-left: 2.25rem;
}
.lineage__node {
  position: absolute;
  left: 0.25rem;
  top: 1rem;
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  border: 2px solid var(--line-strong);
  background: var(--paper);
}
.lineage__entry--active .lineage__node {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-wash);
}
.lineage__entry--live .lineage__node {
  border-color: var(--success);
  background: var(--success);
}
.lineage__entry--failed .lineage__node {
  border-color: var(--signal);
  background: var(--signal-wash);
}
.lineage__entry--origin .lineage__node {
  top: 0.25rem;
  border-radius: 3px;
  transform: rotate(45deg);
  border-color: var(--ink);
  background: var(--ink);
}

.lineage__row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  text-align: left;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.lineage__row:hover {
  border-color: var(--line-strong);
}
.lineage__entry--open .lineage__row {
  border-color: var(--ink);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.lineage__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.lineage__title {
  font-weight: 600;
  color: var(--ink);
}
.lineage__rev {
  display: inline-block;
  min-width: 2rem;
  margin-right: 0.5rem;
  padding: 0 0.375rem;
  border-radius: 4px;
  background: var(--wash);
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: center;
  color: var(--ink-mid);
}
.lineage__entry--live .lineage__rev {
  background: var(--success-wash);
  color: var(--success);
}
.lineage__sub {
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.lineage__side {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.625rem;
}
.lineage__you {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--accent);
}
.lineage__chevron {
  color: var(--ink-soft);
  width: 1rem;
  text-align: center;
}

/* The open re-forecast, attached under its row */
.lineage__detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--ink);
  border-top: 0;
  border-radius: 0 0 10px 10px;
  background: var(--paper);
}
/* The step's panel sits in the open row itself: no second box */
.lineage__detail > .panel {
  border: 0;
  padding: 0;
  background: transparent;
}
.lineage__origin {
  padding: 0.125rem 0 0 0.125rem;
}

@media (max-width: 640px) {
  .lineage__row {
    flex-direction: column;
    align-items: flex-start;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 1.25rem;
}
.panel__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--ink);
}
.panel__quote {
  border-left: 3px solid var(--line-strong);
  padding-left: 0.875rem;
  color: var(--ink-mid);
  font-size: 0.9375rem;
  max-width: 70ch;
}

.covenants {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}
.covenants th,
.covenants td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
.covenants thead th {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-soft);
  text-align: left;
}
.covenants tbody th {
  text-align: left;
}
.covenants thead th.covenants__num {
  text-align: right;
}
.covenants tr:last-child th,
.covenants tr:last-child td {
  border-bottom: 0;
}
.covenants__cell {
  display: inline-flex;
  gap: 0.375rem;
  align-items: baseline;
  font-weight: 600;
}
.covenants__cell--pass {
  color: var(--success);
}
.covenants__cell--fail {
  color: var(--signal);
}
</style>
