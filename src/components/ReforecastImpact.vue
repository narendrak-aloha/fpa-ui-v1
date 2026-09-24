<template>
  <!-- In the step: the moves and the three figures. The bridge that explains
       them opens over the whole screen, where it has the room it needs. -->
  <div class="impact">
    <div class="text-sm">
      <p class="font-medium text-ink-main">All moves in this version of {{ impact?.source_plan_version_code || 'the plan' }}</p>
      <ul v-if="impact?.shocks.length" class="mt-1 space-y-0.5 text-ink-mid">
        <li v-for="(shock, index) in impact.shocks" v-bind:key="index">
          {{ driverName(shock.driver_code) }} {{ driverValue(shock.from_value) }} → {{ driverValue(shock.to_value) }},
          <span class="text-ink-soft">{{ shockScope(shock) }}</span>
        </li>
      </ul>
    </div>

    <ErrorMessage v-bind:message="errorMessage" />
    <p v-if="loading && !impact" class="text-sm text-ink-soft">Working out the impact…</p>

    <template v-if="root">
      <dl class="impact__figures">
        <div>
          <dt>Original</dt>
          <dd>{{ money(root.plan_amount) }}</dd>
        </div>
        <div>
          <dt>Change</dt>
          <dd v-bind:class="Number(root.gap) < 0 ? 'impact__down' : 'impact__up'">{{ signedMoney(root.gap) }}</dd>
        </div>
        <div>
          <dt>This version</dt>
          <dd>{{ money(root.actual_amount) }}</dd>
        </div>
      </dl>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-ink-mid">
          <template v-if="biggest">Most of it is {{ biggest.name.toLowerCase() }}: {{ signedMoney(biggest.value) }}.</template>
          {{ scenarioLabel }} scenario, in {{ currency }}.
        </p>
        <Button variant="subtle" v-on:click="open = true">See what moved it</Button>
      </div>
    </template>
    <p v-else-if="impact?.note" class="text-sm text-ink-soft">{{ impact.note }}</p>

    <FullScreenDialog
      v-bind:open="open"
      title="What moved the plan"
      v-bind:subtitle="`${planCode}, from the original plan to this version`"
      dialog-id="impact-dialog"
      v-on:close="open = false"
    >
      <div class="space-y-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <ul v-if="impact?.shocks.length" class="space-y-0.5 text-sm text-ink-mid">
            <li v-for="(shock, index) in impact.shocks" v-bind:key="index">
              {{ driverName(shock.driver_code) }} {{ driverValue(shock.from_value) }} → {{ driverValue(shock.to_value) }},
              <span class="text-ink-soft">{{ shockScope(shock) }}</span>
            </li>
          </ul>
          <div class="flex items-center gap-2">
            <label class="text-sm text-ink-soft" for="impact-scenario">Scenario</label>
            <select id="impact-scenario" v-model="scenario" class="impact__select">
              <option v-for="option in scenarioOptions" v-bind:key="option.value" v-bind:value="option.value">
                {{ option.label }}
              </option>
            </select>
            <Button variant="ghost" v-bind:loading="loading" v-on:click="load">Refresh</Button>
          </div>
        </div>
        <ErrorMessage v-bind:message="errorMessage" />
        <p v-if="impact?.note" class="text-sm text-ink-soft">{{ impact.note }}</p>
        <BridgeReport
          v-if="impact?.bridge"
          v-bind:preloaded="impact.bridge"
          title="Impact on the plan, from the original plan to this version"
          v-bind:anchors="['Original', 'This version']"
        />
      </div>
    </FullScreenDialog>
  </div>
</template>

<script>
import { Button, ErrorMessage } from 'frappe-ui'
import BridgeReport from '@/components/BridgeReport.vue'
import FullScreenDialog from '@/components/FullScreenDialog.vue'
import { companiesLabel, driverName, driverValue, monthsLabel } from '@/utils/labels'

export default {
  name: 'ReforecastImpact',

  components: { BridgeReport, Button, ErrorMessage, FullScreenDialog },

  props: {
    // A successor version code (PV-…-R<n>)
    planCode: { type: String, required: true },
    // Bumped by the parent when the plan changes state, to read again
    refreshKey: { type: [Number, String], default: 0 },
  },

  data() {
    return {
      scenario: 'base',
      scenarioOptions: [
        { label: 'Base', value: 'base' },
        { label: 'Stretch', value: 'stretch' },
        { label: 'Downside', value: 'downside' },
      ],
      impact: null,
      loading: false,
      // The bridge is open over the whole screen
      open: false,
      errorMessage: '',
    }
  },

  computed: {
    root() {
      return this.impact?.bridge?.root || null
    },

    currency() {
      return this.impact?.bridge?.report_currency || 'USD'
    },

    scenarioLabel() {
      return this.scenarioOptions.find((option) => option.value === this.scenario)?.label || this.scenario
    },

    // The effect that moved the number most, for the one-line summary
    biggest() {
      if (!this.root) return null
      const legs = [['Volume', 'volume'], ['Price', 'price'], ['Mix', 'mix'], ['Efficiency', 'efficiency'], ['Rate', 'rate'], ['Exchange rates', 'fx']]
        .map(([name, key]) => ({ name, value: Number(this.root[key]) || 0 }))
        .filter((leg) => leg.value)
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      return legs[0] || null
    },
  },

  watch: {
    planCode: { immediate: true, handler: 'load' },
    refreshKey: 'load',
    scenario: 'load',
  },

  methods: {
    shockScope(shock) {
      return shock.companies?.length || shock.months?.length
        ? `${companiesLabel(shock.companies)}, ${monthsLabel(shock.months)}`
        : 'whole plan'
    },

    money(value) {
      return `${Math.round(Number(value)).toLocaleString('en-US')} ${this.currency}`
    },

    signedMoney(value) {
      const n = Math.round(Number(value))
      return `${n < 0 ? '−' : '+'}${Math.abs(n).toLocaleString('en-US')} ${this.currency}`
    },

    companiesLabel,
    driverName,
    driverValue,
    monthsLabel,

    async load() {
      const code = this.planCode
      this.loading = true
      this.errorMessage = ''
      const response = await this.$root.callAuthenticatedEndpoint('getPlanImpact', code, this.scenario)
      // A reply for a plan that is no longer shown is dropped
      if (code !== this.planCode) return
      this.loading = false
      if (response.error) {
        this.impact = null
        this.errorMessage = response.message
        return
      }
      this.impact = response.data
    },
  },
}
</script>

<style scoped>
.impact {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.impact__figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}
.impact__figures > div {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
}
.impact__figures dt {
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
.impact__figures dd {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.impact__figures dd.impact__down {
  color: var(--signal);
}
.impact__figures dd.impact__up {
  color: var(--success);
}
@media (max-width: 640px) {
  .impact__figures {
    grid-template-columns: 1fr;
  }
}
.impact__select {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
  padding: 0.25rem 1.75rem 0.25rem 0.5rem;
  font-size: 0.875rem;
  color: var(--ink);
}
</style>
