<template>
  <section class="rounded-[10px] border border-line bg-card">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b p-4">
      <h2 class="font-semibold text-ink-gray-9">{{ title }}</h2>
      <p class="text-sm text-ink-gray-6">{{ statusLine }}</p>
    </div>

    <div v-if="loading" class="flex items-center gap-2 p-4 text-sm text-ink-gray-6">
      <LoadingIndicator class="h-4 w-4" />
      Decomposing the difference.
    </div>

    <ErrorMessage class="p-4" v-bind:message="errorMessage" />

    <template v-if="report">
      <!-- Start, change, end; then what moved it, one bar per effect scaled
           to the effects themselves, so a small change on a large plan is
           still visible. The effects must add up to the change ("ties"). -->
      <div class="space-y-5 p-4">
        <p v-if="selectedNode.path.length" class="text-sm text-ink-soft">
          Showing {{ selectedNode.path.join(' / ') }}
        </p>
        <dl class="bridge__figures">
          <div>
            <dt>{{ anchors[0] }}</dt>
            <dd>{{ money(selectedNode.plan_amount) }}</dd>
          </div>
          <div>
            <dt>Change</dt>
            <dd>{{ signedMoney(selectedNode.gap) }}</dd>
          </div>
          <div>
            <dt>{{ anchors[1] }}</dt>
            <dd>{{ money(selectedNode.actual_amount) }}</dd>
          </div>
        </dl>

        <div>
          <p class="mb-2 font-medium text-ink-main">What moved it</p>
          <ul class="space-y-2" role="list" v-bind:aria-label="`What moved the number from ${anchors[0]} to ${anchors[1]}`">
            <li
              v-for="leg in legs.moved"
              v-bind:key="leg.key"
              class="bridge__leg"
              v-bind:class="{ 'bridge__leg--active': selectedLeg === leg.key, 'bridge__leg--link': report.report_id }"
              v-bind:role="report.report_id ? 'button' : undefined"
              v-bind:tabindex="report.report_id ? 0 : undefined"
              v-bind:title="report.report_id ? `Show the source rows behind ${leg.name}` : ''"
              v-on:click="drill(leg.key)"
              v-on:keydown.enter="drill(leg.key)"
            >
              <span class="bridge__leg-name">
                <span class="block font-medium text-ink-main">{{ leg.name }}</span>
                <span class="block text-xs text-ink-soft">{{ leg.help }}</span>
              </span>
              <span class="bridge__track" aria-hidden="true">
                <span
                  class="bridge__bar"
                  v-bind:class="leg.value < 0 ? 'bridge__bar--down' : 'bridge__bar--up'"
                  v-bind:style="leg.style"
                ></span>
              </span>
              <span class="bridge__leg-value">{{ signedMoney(leg.value) }}</span>
            </li>
          </ul>
          <p v-if="report.report_id" class="mt-2 text-xs text-ink-soft">
            Click an effect to see the source rows behind it.
          </p>
          <p v-if="legs.still.length" class="mt-2 text-sm text-ink-soft">
            No effect from {{ legs.still.join(', ').toLowerCase() }}.
          </p>
        </div>

        <p class="text-sm text-ink-soft">
          {{ selectedNode.ties ? 'The effects add up to the change.' : 'The effects do not add up to the change.' }}
          Left unexplained: {{ cents(selectedNode.residual) }} USD, within the {{ cents(selectedNode.tolerance) }} allowed for rounding.
        </p>
      </div>

      <div class="border-t p-4">
        <p class="mb-2 font-medium text-ink-main">Break it down</p>
        <BridgeNode
          v-bind:node="report.root"
          v-bind:selected-path="selectedPath"
          v-on:select="select"
        />
        <p v-if="!report.report_id" class="mt-2 text-xs text-ink-gray-6">
          Source rows can be drilled into once this comparison is saved as a variance report.
        </p>
      </div>

      <div v-if="rows.length || rowsMessage" class="border-t p-4">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-medium text-ink-gray-7">
            Source rows for {{ selectedNode.path.join(' / ') || 'Total' }}
            <template v-if="selectedLeg">
              · {{ legName(selectedLeg) }} {{ signedMoney(selectedNode[selectedLeg]) }}, largest contribution first
            </template>
            <template v-if="vintageLabel"> · {{ vintageLabel }}</template>
          </p>
          <Button
            v-bind:disabled="nextOffset === null || loadingRows"
            v-bind:loading="loadingRows"
            v-on:click="loadCitations(selectedNode, selectedLeg)"
          >
            {{ nextOffset === null ? 'All rows shown' : 'Show more rows' }}
          </Button>
        </div>
        <p v-if="rowsMessage" class="text-sm text-ink-soft">{{ rowsMessage }}</p>
        <p v-if="selectedLeg && contributionShown !== null" class="mb-2 text-xs text-ink-soft">
          The {{ rows.length.toLocaleString() }} rows shown contribute {{ signedMoney(contributionShown) }}
          of the {{ signedMoney(selectedNode[selectedLeg]) }} {{ legName(selectedLeg).toLowerCase() }} effect.
        </p>
        <div v-if="rows.length" class="max-h-96 overflow-auto rounded border border-line">
          <table class="bridge__rows">
            <thead>
              <tr>
                <th>Company</th>
                <th>Month</th>
                <th>Account</th>
                <th v-for="level in extraLevels" v-bind:key="level.name">{{ niceName(level.name) }}</th>
                <template v-if="sameQuantity"><th class="num">Qty (unchanged)</th></template>
                <template v-else>
                  <th class="num">{{ anchors[0] }} qty</th>
                  <th class="num">{{ anchors[1] }} qty</th>
                </template>
                <template v-if="samePrice"><th class="num">Price (unchanged)</th></template>
                <template v-else>
                  <th class="num">{{ anchors[0] }} price</th>
                  <th class="num">{{ anchors[1] }} price</th>
                </template>
                <th class="num">{{ anchors[0] }} amount</th>
                <th class="num">{{ anchors[1] }} amount</th>
                <th v-if="selectedLeg" class="num">{{ legName(selectedLeg) }}</th>
                <th v-if="hasVintage" class="num">Vintage</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" v-bind:key="rowKey(row)">
                <td>{{ row.company_code }}</td>
                <td>{{ String(row.period_month).slice(0, 7) }}</td>
                <td>{{ row.account_code }}</td>
                <td v-for="level in extraLevels" v-bind:key="level.name">{{ (row.path || [])[level.index] }}</td>
                <td v-if="sameQuantity" class="num">{{ number(row.plan_quantity) }}</td>
                <template v-else>
                  <td class="num">{{ number(row.plan_quantity) }}</td>
                  <td class="num">{{ number(row.actual_quantity) }}</td>
                </template>
                <td v-if="samePrice" class="num">{{ number(row.plan_unit_price) }}</td>
                <template v-else>
                  <td class="num">{{ number(row.plan_unit_price) }}</td>
                  <td class="num">{{ number(row.actual_unit_price) }}</td>
                </template>
                <td class="num">{{ number(row.plan_amount) }}</td>
                <td class="num">{{ number(row.actual_amount) }}</td>
                <td v-if="selectedLeg" class="num">{{ row.contribution == null ? '—' : number(row.contribution) }}</td>
                <td v-if="hasVintage" class="num">{{ row.vintage ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>

<script>
import { Button, ErrorMessage, LoadingIndicator } from 'frappe-ui'
import BridgeNode from '@/components/BridgeNode.vue'
import { niceName } from '@/utils/dsl'

const LEGS = ['price', 'volume', 'mix', 'fx', 'rate', 'efficiency']

// What each effect means, in words a non-specialist can follow
const LEG_TEXT = {
  price: { name: 'Price', help: 'Charging a different rate for the same work' },
  volume: { name: 'Volume', help: 'More or less work in total' },
  mix: { name: 'Mix', help: 'A different blend of practices and grades' },
  fx: { name: 'Exchange rates', help: 'Currency moves against the plan rate' },
  rate: { name: 'Cost rate', help: 'Paying a different rate for delivery' },
  efficiency: { name: 'Efficiency', help: 'More or less effort for the same output' },
}

const USD = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export default {
  name: 'BridgeReport',

  components: { BridgeNode, Button, ErrorMessage, LoadingIndicator },

  props: {
    // { dsl, nonce }: nonce changes even when the same DSL is run again
    request: { type: Object, default: null },
    // A report already computed by the server (e.g. a re-forecast's impact);
    // shown as-is instead of running a DSL.
    preloaded: { type: Object, default: null },
    title: { type: String, default: 'Variance bridge (USD)' },
    // The two ends of the waterfall
    anchors: { type: Array, default: () => ['Plan', 'Actual'] },
  },

  data() {
    return {
      report: null,
      selectedNode: null,
      rows: [],
      rowsMessage: '',
      selectedLeg: null,
      nextOffset: 0,
      loading: false,
      loadingRows: false,
      errorMessage: '',
    }
  },

  computed: {
    statusLine() {
      if (!this.report) return ''
      const vintage = this.report.vintage || {}
      const size = this.report.status === 'ESCALATED' ? 'Large change, flagged for review.' : ''
      const adds = this.report.ties ? 'Adds up at every level.' : 'Does not add up at every level.'
      const books = vintage.vintage == null ? '' : `Books as closed on ${String(vintage.closed_at).slice(0, 10)}.`
      return [size, adds, books].filter(Boolean).join(' ')
    },

    rollup() {
      return this.report?.rollup || []
    },

    // Breakdown levels not already shown as the fixed Company, Month and
    // Account columns (a re-forecast breaks down by account, then company)
    extraLevels() {
      const fixed = new Set(['company', 'company_code', 'account', 'account_code', 'period_month', 'month'])
      return this.rollup.map((name, index) => ({ name, index })).filter((level) => !fixed.has(level.name))
    },

    // A pair that is the same in every row reads once: a utilisation move
    // leaves unit price at baseline, a bill-rate move leaves quantity
    sameQuantity() {
      return this.rows.length > 0 && this.rows.every((row) => Number(row.plan_quantity) === Number(row.actual_quantity))
    },

    samePrice() {
      return this.rows.length > 0 && this.rows.every((row) => Number(row.plan_unit_price) === Number(row.actual_unit_price))
    },

    // Only a plan-versus-actual bridge reads the ledger at a vintage
    hasVintage() {
      return this.rows.some((row) => row.vintage != null)
    },

    vintageLabel() {
      const row = this.rows[0]
      if (!row || row.vintage == null) return ''
      return `vintage ${row.vintage}, closed ${String(row.vintage_closed_at).slice(0, 10)}`
    },

    contributionShown() {
      if (!this.rows.length || this.rows.every((row) => row.contribution == null)) return null
      return this.rows.reduce((sum, row) => sum + Number(row.contribution || 0), 0)
    },

    selectedPath() {
      return this.selectedNode ? this.selectedNode.path.join('|') : ''
    },

    // Effects that moved the number, scaled to the largest of them
    legs() {
      const node = this.selectedNode
      if (!node) return { moved: [], still: [] }
      const moved = []
      const still = []
      for (const key of LEGS) {
        const value = Number(node[key])
        if (Math.abs(value) < 0.5) still.push(LEG_TEXT[key]?.name || niceName(key))
        else moved.push({ key, value, name: LEG_TEXT[key]?.name || niceName(key), help: LEG_TEXT[key]?.help || '' })
      }
      const biggest = Math.max(1, ...moved.map((leg) => Math.abs(leg.value)))
      for (const leg of moved) {
        const width = (Math.abs(leg.value) / biggest) * 50
        leg.style = leg.value < 0 ? { right: '50%', width: `${width}%` } : { left: '50%', width: `${width}%` }
      }
      return { moved, still }
    },
  },

  watch: {
    preloaded: {
      immediate: true,
      handler(report) {
        if (!report) return
        this.report = report
        this.selectedNode = report.root
        this.resetRows()
        this.errorMessage = ''
      },
    },

    request: {
      immediate: true,
      handler(request) {
        if (request && request.dsl) this.load(request.dsl)
      },
    },
  },

  methods: {
    money(value) {
      return `${USD.format(Number(value))} USD`
    },

    signedMoney(value) {
      const number = Number(value)
      return `${number > 0 ? '+' : number < 0 ? '−' : ''}${USD.format(Math.abs(number))} USD`
    },

    cents(value) {
      return Math.abs(Number(value)).toFixed(2)
    },

    async load(dsl) {
      this.loading = true
      this.errorMessage = ''
      this.report = null
      this.resetRows()
      const response = await this.$root.callAuthenticatedEndpoint('runBridge', dsl)
      this.loading = false
      if (response.error) {
        this.errorMessage = response.message
        return
      }
      this.report = response.data
      this.selectedNode = response.data.root
    },

    niceName,

    legName(key) {
      return LEG_TEXT[key]?.name || niceName(key)
    },

    number(value) {
      if (value == null) return '—'
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
    },

    rowKey(row) {
      return [row.company_code, row.period_month, row.account_code, row.dim_signature_hash].join('|')
    },

    resetRows() {
      this.rows = []
      this.rowsMessage = ''
      this.nextOffset = 0
    },

    select(node) {
      this.selectedNode = node
      this.selectedLeg = null
      this.resetRows()
      if (this.report.report_id) this.loadCitations(node, null)
    },

    // Click an effect: the rows behind this node, each with what it
    // contributed to that effect, so the number can be traced to its rows
    drill(leg) {
      if (!this.report?.report_id) return
      this.selectedLeg = leg
      this.resetRows()
      this.loadCitations(this.selectedNode, leg)
    },

    // Paged: a node can stand on thousands of ledger lines.
    async loadCitations(node, leg) {
      if (this.nextOffset === null) return
      this.loadingRows = true
      const response = await this.$root.callAuthenticatedEndpoint(
        'getCitations',
        this.report.report_id,
        node.path.join('|'),
        this.nextOffset,
        leg,
      )
      this.loadingRows = false
      if (response.error) {
        this.rowsMessage = response.message
        return
      }
      this.rows = this.rows.concat(response.data.rows)
      if (!this.rows.length) this.rowsMessage = 'No source rows are recorded for this line.'
      this.nextOffset = response.data.next_offset
    },
  },
}
</script>

<style scoped>
.bridge__leg--link {
  cursor: pointer;
  border-radius: 6px;
}
.bridge__leg--link:hover,
.bridge__leg--link:focus-visible {
  background: var(--surface-hover, rgba(0, 0, 0, 0.04));
  outline: none;
}
.bridge__leg--active {
  box-shadow: inset 3px 0 0 currentColor;
}
.bridge__rows {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}
.bridge__rows th,
.bridge__rows td {
  padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  text-align: left;
}
.bridge__rows th {
  position: sticky;
  top: 0;
  background: var(--card, #fff);
  font-weight: 600;
}
.bridge__rows .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bridge__figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}
.bridge__figures > div {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  background: var(--paper);
}
.bridge__figures dt {
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
.bridge__figures dd {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
}
@media (max-width: 640px) {
  .bridge__figures {
    grid-template-columns: 1fr;
  }
}
.bridge__leg {
  display: grid;
  grid-template-columns: minmax(8rem, 14rem) minmax(0, 1fr) 9rem;
  align-items: center;
  gap: 0.75rem;
}
@media (max-width: 640px) {
  .bridge__leg {
    grid-template-columns: 1fr auto;
  }
  .bridge__track {
    grid-column: 1 / -1;
    order: 3;
  }
}
.bridge__track {
  position: relative;
  height: 1.125rem;
  background: linear-gradient(var(--line-strong), var(--line-strong)) center / 1px 100% no-repeat;
}
.bridge__bar {
  position: absolute;
  top: 0.1875rem;
  bottom: 0.1875rem;
  border-radius: 3px;
}
.bridge__bar--up {
  background: var(--accent);
}
.bridge__bar--down {
  background: var(--muted);
}
.bridge__leg-value {
  text-align: right;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
}
</style>
