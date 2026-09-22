<template>
  <div class="space-y-3">
    <ErrorMessage v-bind:message="error" />
    <p v-if="loading && !summary" class="text-sm text-ink-soft">Loading the recomputed lines…</p>
    <template v-if="summary">
      <p class="text-sm text-ink-mid">
        {{ summary.line_count.toLocaleString('en-US') }} recomputed lines<template v-if="summary.line_count">
          for {{ summary.companies.join(', ') }}, {{ month(summary.first_month) }} to {{ month(summary.last_month) }}</template>.
        Every other line in the plan is untouched. The largest are shown; each carries how it was derived.
      </p>
      <div v-if="lines.length" class="overflow-x-auto">
        <table class="lines">
          <thead>
            <tr>
              <th>Company</th>
              <th>Month</th>
              <th>Account</th>
              <th class="lines__num">Quantity</th>
              <th class="lines__num">Unit price</th>
              <th class="lines__num">Amount</th>
              <th>Derivation</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, index) in lines" v-bind:key="index" v-bind:class="{ 'lines__row--on': index === openIndex }">
              <td>{{ line.company_code }}</td>
              <td class="whitespace-nowrap">{{ month(line.period_month) }}</td>
              <td>{{ line.account_code }}</td>
              <td class="lines__num">{{ number(line.quantity) }}</td>
              <td class="lines__num">{{ number(line.unit_price) }}</td>
              <td class="lines__num font-medium">{{ number(line.amount_functional) }} {{ line.functional_currency }}</td>
              <td>
                <button
                  type="button"
                  class="lines__trace"
                  v-bind:aria-expanded="index === openIndex"
                  v-bind:aria-controls="panelId"
                  v-on:click="openIndex = openIndex === index ? -1 : index"
                >
                  {{ traceLabel(line) }} <span aria-hidden="true">›</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <SidePanel
      v-bind:open="Boolean(openLine)"
      title="How this line was worked out"
      v-bind:subtitle="openLine ? `${openLine.company_code}, ${month(openLine.period_month)}, account ${openLine.account_code}` : ''"
      v-bind:panel-id="panelId"
      v-on:close="openIndex = -1"
    >
      <LineDerivation v-if="openLine" v-bind:line="openLine" />
    </SidePanel>
  </div>
</template>

<script>
import { ErrorMessage } from 'frappe-ui'
import LineDerivation from '@/components/LineDerivation.vue'
import SidePanel from '@/components/SidePanel.vue'
import { driverName } from '@/utils/labels'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default {
  name: 'PlanLines',

  components: { ErrorMessage, LineDerivation, SidePanel },

  props: {
    planCode: { type: String, required: true },
    limit: { type: Number, default: 12 },
  },

  data() {
    return {
      summary: null,
      lines: [],
      error: '',
      loading: false,
      // The line whose derivation is open in the side panel
      openIndex: -1,
      // Unique per table: a page can show the same version's lines twice
      panelId: `line-derivation-${Math.random().toString(36).slice(2, 8)}`,
    }
  },

  computed: {
    openLine() {
      return this.lines[this.openIndex] || null
    },
  },

  watch: {
    planCode: { immediate: true, handler: 'load' },
  },

  methods: {
    async load() {
      this.loading = true
      this.error = ''
      const response = await this.$root.callAuthenticatedEndpoint('getPlanLines', this.planCode, { limit: this.limit })
      this.loading = false
      if (response.error) {
        this.error = response.message
        return
      }
      this.summary = response.data.summary
      this.lines = response.data.lines
      this.openIndex = -1
    },

    month(iso) {
      if (!iso) return ''
      return `${MONTHS[Number(String(iso).slice(5, 7)) - 1]} ${String(iso).slice(0, 4)}`
    },

    number(value) {
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
    },

    // The driver that moved the line, or where it came from
    traceLabel(line) {
      const trace = line.driver_derivation_trace || {}
      if (trace.method === 'seeded_plan') return 'Agreed plan'
      return driverName(trace.driver || 'Derivation')
    },
  },
}
</script>

<style scoped>
.lines {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.lines th,
.lines td {
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
  text-align: left;
}
.lines thead th {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-soft);
}
.lines__trace {
  white-space: nowrap;
  color: var(--accent);
  font-weight: 500;
}
.lines__trace:hover {
  text-decoration: underline;
}
.lines__row--on td {
  background: var(--accent-wash);
}
.lines .lines__num {
  text-align: right;
  white-space: nowrap;
}
</style>
