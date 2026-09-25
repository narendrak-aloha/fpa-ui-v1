<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-sm text-ink-gray-7">
      <span class="font-medium text-ink-gray-8">Run on {{ runCode }}</span>
      <span v-if="progress.revision">· revision {{ progress.revision }}</span>
      <span v-if="progress.continued_runs">· continued {{ progress.continued_runs }}×</span>
      <StatusPill v-bind:label="statusLabel" v-bind:tone="statusTone" />
    </div>

    <!-- Phase timeline: done steps filled, the current one outlined -->
    <ol class="flex flex-wrap gap-1" aria-label="Run phases">
      <li
        v-for="(step, index) in RUN_PHASES"
        v-bind:key="step.phase"
        class="rounded px-2 py-1 text-xs"
        v-bind:class="stepClass(index)"
        v-bind:aria-current="index === currentIndex ? 'step' : undefined"
      >
        {{ step.label }}
      </li>
    </ol>

    <div v-if="progress.dirty_rows" class="space-y-1">
      <div class="flex justify-between text-xs text-ink-gray-6">
        <span>
          {{ progress.processed_rows.toLocaleString() }} /
          {{ progress.dirty_rows.toLocaleString() }} rows
        </span>
        <span v-if="progress.partitions_total">
          partitions {{ progress.partitions_done }} / {{ progress.partitions_total }}
        </span>
        <span>{{ percent }}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded bg-surface-gray-3">
        <div class="h-full bg-accent transition-all" v-bind:style="{ width: `${percent}%` }"></div>
      </div>
    </div>

    <ul v-if="progress.shocks.length" class="text-xs text-ink-gray-7">
      <li
        v-for="([driver, from, to, companies, months], index) in progress.shocks"
        v-bind:key="index"
      >
        {{ driver }}: {{ from }} → {{ to }} ({{ change(from, to) }})
        · {{ scopeLabel(companies, months) }}
      </li>
    </ul>

    <!-- What still stands between the parked run and a publish -->
    <div v-if="parked" class="rounded border p-3 text-sm">
      <p class="mb-2 font-medium text-ink-gray-8">
        {{ progress.target_version_code }}: {{ waitingFor }}
      </p>
      <ul class="space-y-1 text-ink-gray-7">
        <li>{{ gatePassed('AWAITING_SUBMISSION') ? '☑' : '☐' }} Reviewed and submitted by the planner</li>
        <li>{{ gatePassed('AWAITING_SUBMISSION') ? '☑' : '☐' }} Covenants checked by the system (a breach rejects it)</li>
        <li>
          {{ gatePassed('AWAITING_APPROVAL') ? '☑' : '☐' }} Approved by a controller
          <span class="text-ink-gray-5">(not {{ successor?.requested_by ? personName(successor.requested_by) : 'the requester' }})</span>
        </li>
        <li>☐ Locked by the CFO <span class="text-ink-gray-5">(not the approver); the system then publishes</span></li>
      </ul>
    </div>

    <div v-if="progress.refusals.length" class="space-y-1" role="alert">
      <p class="text-sm font-medium text-ink-red-4">
        {{ parked ? 'Decisions governance refused' : 'Decisions refused earlier in this run' }}
      </p>
      <ul class="list-disc pl-5 text-sm text-ink-red-4">
        <li v-for="(refusal, index) in progress.refusals" v-bind:key="index">{{ refusal }}</li>
      </ul>
    </div>
  </div>
</template>

<script>
import StatusPill from '@/components/StatusPill.vue'
import { personName } from '@/utils/labels'
import { GATE_PHASES, RUN_PHASES, isFinished } from '@/utils/workflowRules'

// The durable record's run state, once the workflow reports DONE
export default {
  name: 'RunTracker',

  components: { StatusPill },

  props: {
    runCode: { type: String, required: true },
    // The workflow's progress query, as the API returns it
    progress: { type: Object, required: true },
    // describe() of the successor version, when it has been read
    successor: { type: Object, default: null },
    // How the run ended, in words (e.g. "Published", "Rolled back") — the
    // caller's own state label, so this badge always agrees with every
    // other badge for the same state rather than guessing its own.
    outcome: { type: String, default: '' },
    // The colour that label carries, from that same source: done/failed/
    // closed/active/waiting. Only an actual completion is green; a
    // rejection or a rollback is red; a cancel or a timeout is neutral.
    outcomeTone: { type: String, default: '' },
  },

  data() {
    return { RUN_PHASES }
  },

  computed: {
    currentIndex() {
      return RUN_PHASES.findIndex((step) => step.phase === this.progress.phase)
    },

    finished() {
      return isFinished(this.progress.phase)
    },

    statusLabel() {
      if (this.progress.phase === 'FAILED') return 'Failed'
      if (this.finished) return this.outcome || 'Done'
      if (this.progress.approval_state === 'CANCELLED') return 'Cancelling'
      return this.progress.phase
    },

    statusTone() {
      if (this.progress.phase === 'FAILED') return 'failed'
      if (this.finished) return this.outcomeTone || 'closed'
      return 'active'
    },

    percent() {
      const { dirty_rows: total, processed_rows: done } = this.progress
      return total ? Math.min(100, Math.round((done / total) * 100)) : 0
    },

    parked() {
      return GATE_PHASES.includes(this.progress.phase)
    },

    waitingFor() {
      return {
        AWAITING_SUBMISSION: 'waiting for the planner to review and submit',
        AWAITING_APPROVAL: 'waiting for a controller to approve or reject',
        AWAITING_LOCK: 'waiting for the CFO to lock',
      }[this.progress.phase]
    },
  },

  methods: {
    personName,

    // The run is past this gate: it parks at each one in order
    gatePassed(phase) {
      return GATE_PHASES.indexOf(this.progress.phase) > GATE_PHASES.indexOf(phase)
    },

    // A shock with no scope applies to the whole plan
    scopeLabel(companies, months) {
      if (!companies?.length && !months?.length) return 'whole plan'
      const who = companies?.length ? companies.join(', ') : 'all companies'
      if (!months?.length) return `${who}, all months`
      const when = months.length === 1 ? months[0].slice(0, 7) : `${months[0].slice(0, 7)} to ${months[months.length - 1].slice(0, 7)}`
      return `${who}, ${when}`
    },

    stepClass(index) {
      const filled = 'bg-surface-gray-7 text-ink-white'
      const empty = 'bg-surface-gray-2 text-ink-gray-5'
      // A run that ended early (rejected, expired, cancelled) also reports
      // DONE without passing the publish steps, and progress does not say
      // where it stopped; only a completed one lights the whole line.
      if (this.finished) return ['COMPLETED', 'Published'].includes(this.outcome) ? filled : empty
      if (index === this.currentIndex) return 'border border-accent bg-accent-wash font-medium text-accent'
      return index < this.currentIndex ? filled : empty
    },

    change(from, to) {
      const delta = ((to - from) / from) * 100
      return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`
    },
  },
}
</script>
