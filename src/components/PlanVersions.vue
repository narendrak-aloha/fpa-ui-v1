<template>
  <div class="desk">
    <!-- Left: the agreed plans. A plan's re-forecasts open with it. -->
    <aside class="desk__rail" aria-label="Plans">
      <div class="desk__rail-head">
        <h2 class="text-lg font-semibold text-ink-main">Plans</h2>
        <Button variant="ghost" v-bind:loading="busy === 'plans'" v-on:click="loadPlans">Refresh</Button>
      </div>
      <ErrorMessage class="px-4" v-bind:message="plansError" />
      <ul>
        <li v-for="plan in rootPlans" v-bind:key="plan.plan_version_code">
          <button
            type="button"
            class="desk__plan"
            v-bind:class="{ 'desk__plan--on': plan.plan_version_code === planCode }"
            v-bind:aria-current="plan.plan_version_code === planCode ? 'true' : undefined"
            v-on:click="selectPlan(plan.plan_version_code)"
          >
            <span class="whitespace-nowrap font-semibold text-ink-main">{{ plan.plan_version_code }}</span>
            <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusPill v-bind="pill(plan.state)" />
              <span class="text-sm text-ink-soft">{{ railLine(plan) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </aside>

    <!-- Right: the plan, its own sign-off, then its re-forecasts -->
    <section class="desk__detail">
      <template v-if="currentPlan">
        <header class="desk__plan-head">
          <div class="space-y-1">
            <h3 class="flex flex-wrap items-center gap-3 text-2xl font-semibold text-ink-main">
              {{ currentPlan.plan_version_code }}
              <StatusPill v-bind="pill(currentPlan.state)" />
            </h3>
            <p class="text-ink-mid">
              Drafted by {{ personName(currentPlan.requested_by) }}<template v-if="currentPlan.approved_by">,
                approved by {{ personName(currentPlan.approved_by) }}</template>.
              Covenant {{ currentPlan.covenant_ok ? 'passed' : currentPlan.state === 'REJECTED' ? 'not passed' : 'not passed yet' }}.
            </p>
          </div>
          <p v-if="liveVersion" class="desk__live">
            <span class="desk__live-dot" aria-hidden="true"></span>
            Live numbers: <span class="font-semibold">{{ liveVersion }}</span>
          </p>
        </header>

        <!-- The plan's own sign-off: open while it is being agreed, one line once it is -->
        <div class="panel">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="panel__title">{{ agreed ? 'Agreed' : 'Getting this plan agreed' }}</h4>
            <Button v-if="agreed" variant="ghost" v-on:click="signoffOpen = !signoffOpen">
              {{ signoffOpen ? 'Hide sign-off' : 'Show sign-off' }}
            </Button>
          </div>
          <p v-if="agreed && !signoffOpen" class="text-ink-mid">{{ agreedLine }}</p>

          <template v-if="!agreed || signoffOpen">
            <SignoffSlip v-model="step" v-bind:steps="steps" label="Sign-off for this plan" />
            <p class="text-ink-mid">{{ stepText.text }}</p>

            <div v-if="showNote" class="max-w-lg">
              <FormControl v-model="reviewNote" label="Note for the record (optional)" />
            </div>

            <div v-if="step === 'covenant' && !['LOCKED', 'SUPERSEDED'].includes(currentPlan.state)" class="flex flex-wrap gap-2">
              <GuardedButton
                variant="solid"
                v-bind:blocker="covenantBlocker(true)"
                v-bind:loading="busy === 'covenant-pass'"
                v-on:click="recordCovenant(true)"
              >
                Record covenant pass
              </GuardedButton>
              <GuardedButton
                v-bind:blocker="covenantBlocker(false)"
                v-bind:loading="busy === 'covenant-fail'"
                v-on:click="recordCovenant(false)"
              >
                Record covenant breach
              </GuardedButton>
            </div>

            <div v-if="stepTransitions.length" class="flex flex-wrap gap-2">
              <GuardedButton
                v-for="(transition, index) in stepTransitions"
                v-bind:key="transition.state"
                v-bind:variant="index === 0 ? 'solid' : 'subtle'"
                v-bind:blocker="transitionBlocker(transition)"
                v-bind:loading="busy === `transition-${transition.state}`"
                v-on:click="transitionPlan(transition.state)"
              >
                {{ transitionLabel(transition.state) }}
              </GuardedButton>
            </div>

            <details class="text-sm">
              <summary class="cursor-pointer text-ink-soft">Everything the system holds on this plan</summary>
              <pre class="mt-2 max-h-72 overflow-auto rounded-md bg-paper p-3 text-xs text-ink-main">{{ JSON.stringify(currentPlan, null, 2) }}</pre>
            </details>
          </template>

          <div v-if="actionStatus || errorMessage" class="space-y-1">
            <ErrorMessage v-bind:message="errorMessage" />
            <p v-if="actionStatus" class="text-sm text-ink-mid">{{ actionStatus }}</p>
          </div>
        </div>

        <ReforecastRequests
          v-bind:plan-code="currentPlan.plan_version_code"
          v-bind:versions="reforecastVersions"
          v-bind:live-version="liveVersion"
          v-bind:focus-id="focusId"
          v-on:changed="onReforecastChanged"
          v-on:attention="reforecastCount = $event"
          v-on:focus-plan="selectPlan"
          v-on:go-ask="$emit('go-ask')"
        />
      </template>

      <p v-else-if="!plansError" class="text-ink-mid">Pick a plan to see how it was agreed and every re-forecast of it.</p>
    </section>
  </div>
</template>

<script>
import { Button, ErrorMessage, FormControl } from 'frappe-ui'
import GuardedButton from '@/components/GuardedButton.vue'
import ReforecastRequests from '@/components/ReforecastRequests.vue'
import SignoffSlip from '@/components/SignoffSlip.vue'
import StatusPill from '@/components/StatusPill.vue'
import { personName, planState } from '@/utils/labels'
import {
  covenantBlocker,
  planAttention,
  planTransitions,
  transitionBlocker,
} from '@/utils/workflowRules'

const TRANSITION_LABELS = {
  IN_REVIEW: 'Submit for review',
  APPROVED: 'Approve plan',
  REJECTED: 'Reject plan',
  LOCKED: 'Lock plan',
  SUPERSEDED: 'Mark as replaced',
}

// Which slip step each move belongs to
const TRANSITION_STEP = {
  IN_REVIEW: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'approved',
  LOCKED: 'locked',
  SUPERSEDED: 'locked',
}

export default {
  name: 'PlanVersions',

  components: { Button, ErrorMessage, FormControl, GuardedButton, ReforecastRequests, SignoffSlip, StatusPill },

  props: {
    // A request the planner's question just drafted: its plan opens with it
    focusId: { type: String, default: '' },
  },

  // attention: plans and re-forecasts waiting on this user, for the tab count
  // go-ask: to the Ask tab, to ask for a re-forecast
  emits: ['attention', 'go-ask'],

  data() {
    return {
      planCode: this.$root.config.DEFAULT_PLAN_CODE,
      reviewNote: '',
      step: 'drafted',
      // A plan that is already agreed shows its sign-off as one line until opened
      signoffOpen: false,
      // Re-forecasts of any plan waiting on this user, as the re-forecast list counts them
      reforecastCount: 0,

      // Read from the server so nobody has to know a code by heart. It can
      // fail for a token without global scope; the server still decides.
      plans: [],
      plansError: '',

      // The plan as last read. Its row_version is sent back with every write,
      // so an edit made against a stale copy is refused rather than silently
      // overwriting someone else's.
      loadedPlan: null,

      actionStatus: '',
      errorMessage: '',
      busy: '',
    }
  },

  computed: {
    user() {
      return this.$root.user
    },

    currentPlan() {
      return this.loadedPlan?.plan_version_code === this.planCode ? this.loadedPlan : null
    },

    // Only agreed plans are listed; a re-forecast shows under its plan
    rootPlans() {
      return this.plans
        .filter((plan) => !plan.supersedes_plan_version_code)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    },

    reforecastVersions() {
      return this.plans.filter((plan) => plan.supersedes_plan_version_code === this.planCode)
    },

    // Whose numbers are live: the newest locked re-forecast, else the plan once agreed
    liveVersion() {
      const locked = this.reforecastVersions
        .filter((plan) => plan.state === 'LOCKED')
        .sort((a, b) => (b.revision || 0) - (a.revision || 0))
      if (locked.length) return locked[0].plan_version_code
      return ['LOCKED', 'APPROVED'].includes(this.currentPlan?.state) ? this.currentPlan.plan_version_code : ''
    },

    agreed() {
      return ['LOCKED', 'SUPERSEDED'].includes(this.currentPlan?.state)
    },

    agreedLine() {
      const p = this.currentPlan
      if (!p) return ''
      const approver = p.approved_by ? `, approved by ${personName(p.approved_by)}` : ''
      const after = p.state === 'SUPERSEDED' ? ' Its numbers have since been replaced by a re-forecast.' : ''
      return `Drafted by ${personName(p.requested_by)}, covenant passed${approver}, locked by the CFO.${after}`
    },

    needingMe() {
      return this.plans.filter((plan) => this.attention(plan)).length + this.reforecastCount
    },

    transitions() {
      return planTransitions(this.currentPlan)
    },

    stepTransitions() {
      return this.transitions.filter((transition) => TRANSITION_STEP[transition.state] === this.step)
    },

    showNote() {
      return this.stepTransitions.length > 0 || (this.step === 'covenant' && !['LOCKED', 'SUPERSEDED'].includes(this.currentPlan?.state))
    },


    steps() {
      const p = this.currentPlan
      if (!p) return []
      const s = p.state
      const turn = (role) => (this.user.hasRole(role) ? 'Your turn' : `Waiting for the ${role === 'cfo' ? 'CFO' : role}`)
      const after = { DRAFT: 0, IN_REVIEW: 1, APPROVED: 3, LOCKED: 4, SUPERSEDED: 4, REJECTED: 1 }[s] ?? 0
      const signedUpTo = (index) => after >= index

      const drafted = { state: 'signed', stamp: personName(p.requested_by) }
      const submitted = s === 'DRAFT' ? { state: 'current', stamp: turn('planner') } : { state: 'signed', stamp: 'Sent for review' }

      let covenant
      if (p.covenant_ok) covenant = { state: 'signed', stamp: 'Passed' }
      else if (s === 'IN_REVIEW') covenant = { state: 'current', stamp: turn('controller') }
      else if (s === 'REJECTED') covenant = { state: 'skipped' }
      else covenant = { state: 'pending' }

      let approved
      if (s === 'REJECTED') approved = { state: 'failed', stamp: 'Rejected' }
      else if (signedUpTo(3)) approved = { state: 'signed', stamp: p.approved_by ? personName(p.approved_by) : 'Done' }
      else if (s === 'IN_REVIEW' && p.covenant_ok) approved = { state: 'current', stamp: turn('controller') }
      else approved = { state: 'pending' }

      let locked
      if (s === 'LOCKED') locked = { state: 'signed', stamp: 'Nothing can change' }
      else if (s === 'SUPERSEDED') locked = { state: 'signed', stamp: 'Locked, then replaced by a re-forecast' }
      else if (s === 'APPROVED') locked = { state: 'current', stamp: turn('cfo') }
      else if (s === 'REJECTED') locked = { state: 'skipped' }
      else locked = { state: 'pending' }

      return [
        { key: 'drafted', title: 'Drafted', who: 'Planner', ...drafted },
        { key: 'submitted', title: 'Submitted', who: 'Planner', ...submitted },
        { key: 'covenant', title: 'Covenant', who: 'Controller', ...covenant },
        { key: 'approved', title: 'Approved', who: 'Controller', ...approved },
        { key: 'locked', title: 'Locked', who: 'CFO', ...locked },
      ]
    },

    stepText() {
      const state = this.currentPlan?.state
      return {
        drafted: { title: 'Drafted', text: 'The planner wrote this plan.' },
        submitted: { title: 'Submit for review', text: 'The planner sends the draft to the controller. After this it can only change if it is rejected.' },
        covenant: {
          title: 'Covenant review',
          text: this.currentPlan?.covenant_ok
            ? 'A controller recorded that this plan meets its covenants.'
            : 'A controller records whether this plan meets its covenants. A plan cannot be approved without a pass.',
        },
        approved: state === 'REJECTED'
          ? { title: 'Rejected', text: 'This plan was rejected, and a rejected plan stays rejected. A different plan is a new version.' }
          : { title: 'Approve or reject', text: 'A controller who did not draft the plan approves it, or rejects it for good.' },
        locked: {
          title: 'Lock',
          text: state === 'LOCKED'
            ? 'Locked. Nothing in this plan can change, not even directly in the database. Changes from here are re-forecasts.'
            : 'The CFO locks the approved plan. After that it can only change through a re-forecast.',
        },
      }[this.step] || { title: '', text: '' }
    },
  },

  watch: {
    needingMe: {
      immediate: true,
      handler(count) {
        this.$emit('attention', count)
      },
    },
  },

  mounted() {
    this.loadPlans().then(() => {
      // Open on the default plan when it exists, else the newest agreed plan
      if (!this.rootPlans.some((plan) => plan.plan_version_code === this.planCode) && this.rootPlans.length) {
        this.planCode = this.rootPlans[0].plan_version_code
      }
      return this.loadPlan()
    })
  },

  methods: {
    personName,

    railLine(plan) {
      const count = this.plans.filter((row) => row.supersedes_plan_version_code === plan.plan_version_code).length
      const needs = this.attention(plan)
      const reforecasts = count === 1 ? '1 re-forecast' : `${count} re-forecasts`
      return needs || reforecasts
    },

    async onReforecastChanged() {
      await this.loadPlans()
      if (this.currentPlan) await this.loadPlan()
    },

    attention(plan) {
      return planAttention(this.user, plan)
    },

    pill(state) {
      return planState(state)
    },

    transitionLabel(state) {
      return TRANSITION_LABELS[state] || `Move to ${state}`
    },

    transitionBlocker(transition) {
      return transitionBlocker(this.user, this.currentPlan, transition)
    },

    covenantBlocker(covenantOk) {
      return covenantBlocker(this.user, this.currentPlan, covenantOk)
    },

    focusStep() {
      const open = this.steps.find((step) => step.state === 'current' || step.state === 'failed')
      const signed = this.steps.filter((step) => step.state === 'signed')
      this.step = open?.key || signed[signed.length - 1]?.key || 'drafted'
    },

    // Every call goes through here so one place reports failure and clears the
    // busy state, whichever button was pressed.
    async run(key, endpoint, ...args) {
      this.busy = key
      this.errorMessage = ''
      this.actionStatus = ''
      const response = await this.$root.callAuthenticatedEndpoint(endpoint, ...args)
      this.busy = ''
      if (response.error) {
        this.errorMessage = response.message
        return null
      }
      return response.data
    },

    async loadPlans() {
      this.busy = 'plans'
      const response = await this.$root.callAuthenticatedEndpoint('listPlanVersions')
      if (this.busy === 'plans') this.busy = ''
      this.plansError = response.error ? response.message : ''
      if (!response.error) this.plans = response.data
    },

    async selectPlan(code) {
      if (code === this.planCode && this.currentPlan) return
      this.planCode = code
      this.signoffOpen = false
      this.actionStatus = ''
      this.errorMessage = ''
      await this.loadPlan()
    },

    async loadPlan() {
      const plan = await this.run('load', 'getPlanVersion', this.planCode)
      if (!plan) return
      const listed = this.plans.find((row) => row.plan_version_code === plan.plan_version_code)
      this.loadedPlan = { ...plan, supersedes_plan_version_code: listed?.supersedes_plan_version_code }
      this.focusStep()
    },

    async recordCovenant(covenantOk) {
      const done = await this.run(
        covenantOk ? 'covenant-pass' : 'covenant-fail',
        'recordCovenant',
        this.planCode,
        { covenantOk, note: this.reviewNote, expectedVersion: this.currentPlan.row_version },
      )
      if (done) {
        this.reviewNote = ''
        await this.loadPlan()
        this.loadPlans()
        this.actionStatus = covenantOk ? 'Covenant pass recorded.' : 'Covenant breach recorded.'
      }
    },

    async transitionPlan(toState) {
      const done = await this.run(`transition-${toState}`, 'transitionPlan', this.planCode, {
        toState,
        note: this.reviewNote,
        expectedVersion: this.currentPlan.row_version,
      })
      if (done) {
        this.reviewNote = ''
        await this.loadPlan()
        this.loadPlans()
        this.actionStatus = `${this.transitionLabel(toState)}: done.`
      }
    },
  },
}
</script>

<style scoped>
.desk {
  display: grid;
  grid-template-columns: minmax(12rem, 14rem) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.desk__rail {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding-bottom: 0.5rem;
  position: sticky;
  top: 1rem;
}
.desk__rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem 0.5rem;
}
.desk__plan {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  border-left: 3px solid transparent;
}
.desk__plan:hover {
  background: var(--paper);
}
.desk__plan--on,
.desk__plan--on:hover {
  background: var(--wash);
  border-left-color: var(--ink);
}

.desk__detail {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}
.desk__plan-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
}
.desk__live {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  background: var(--success-wash);
  border: 1px solid var(--success-line);
  color: var(--success);
  font-size: 0.875rem;
}
.desk__live-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 999px;
  background: var(--success);
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

/* On a narrow screen the plans sit above as one scrolling row */
@media (max-width: 900px) {
  .desk {
    grid-template-columns: 1fr;
  }
  .desk__rail {
    position: static;
  }
  .desk__rail ul {
    display: flex;
    overflow-x: auto;
  }
  .desk__plan {
    min-width: 14rem;
    border-left: 0;
    border-bottom: 3px solid transparent;
  }
  .desk__plan--on,
  .desk__plan--on:hover {
    border-bottom-color: var(--ink);
  }
}
</style>
