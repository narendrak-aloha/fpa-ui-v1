<template>
  <section
    class="answer"
    v-bind:class="{ 'answer--bad': outcome.tone === 'bad' }"
  >
    <!-- 1. The answer in words -->
    <div class="space-y-2 p-4">
      <p v-if="outcome.title" class="font-semibold text-ink-main">{{ outcome.title }}</p>
      <p v-if="text" class="answer__text">{{ text }}</p>
      <p v-if="note" class="text-sm text-signal">{{ note }}</p>
    </div>

    <!-- 2. The figures the answer may cite, largest first -->
    <div v-if="rows.length" class="border-t px-4 py-3">
      <div class="overflow-x-auto">
        <table class="answer__table">
          <thead>
            <tr>
              <th
                v-for="(column, index) in columns"
                v-bind:key="column"
                v-bind:class="{ 'text-right': numeric[index] }"
              >
                {{ niceName(column) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in shownRows" v-bind:key="rowIndex">
              <td
                v-for="(column, index) in columns"
                v-bind:key="column"
                v-bind:class="{ 'text-right tabular-nums': numeric[index] }"
              >
                {{ formatCell(column, row[column], decimals[index]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <button v-if="emptyRows.length" type="button" class="answer__more" v-on:click="showEmpty = !showEmpty">
        {{ showEmpty ? 'Hide' : 'Show' }} {{ emptyRows.length }} {{ emptyRows.length === 1 ? 'row' : 'rows' }} with no figures
      </button>
    </div>

    <!-- 3. What to do next, when there is something -->
    <div v-if="answer.reforecast_request_id || hasBridge || answer.proposal_id" class="flex flex-wrap items-center gap-3 border-t px-4 py-3">
      <span v-if="answer.proposal_id" class="text-sm text-ink-soft">
        A new driver formula was drafted and waits for a controller's review (proposal {{ answer.proposal_id }}).
      </span>
      <template v-if="answer.reforecast_request_id">
        <Button variant="solid" v-on:click="$emit('open-request', answer.reforecast_request_id)">Open it to confirm</Button>
        <span class="text-sm text-ink-soft">{{ draftLine }} Nothing changes until you confirm it.</span>
      </template>
      <Button v-if="hasBridge" v-on:click="toggleBridge">
        {{ bridgeRequest ? 'Hide the variance bridge' : 'Show the variance bridge' }}
      </Button>
    </div>
    <div v-if="bridgeRequest" class="border-t p-3">
      <BridgeReport v-bind:request="bridgeRequest" />
    </div>

    <div v-if="driftFlags" class="border-t px-4 py-3">
      <pre class="overflow-x-auto rounded bg-surface-gray-2 p-3 text-xs text-ink-gray-7">{{ driftFlags }}</pre>
    </div>

    <div class="border-t px-4 py-3">
      <Button
        variant="ghost"
        v-bind:aria-expanded="explained"
        aria-controls="answer-explanation"
        v-on:click="$emit('explain')"
      >
        {{ explained ? 'Hide Explanation' : 'Show Explanation' }}
      </Button>
    </div>
  </section>
</template>

<script>
import { Button } from 'frappe-ui'
import BridgeReport from '@/components/BridgeReport.vue'
import { companiesLabel, driverName, driverValue, monthsLabel } from '@/utils/labels'
import { OUTCOME, compactCompanies, formatCell, niceName } from '@/utils/dsl'

// The model writes raw numbers and, sometimes, the whole list of company codes
// in scope. Numbers get separators; a long list of codes becomes a count.
function readable(text) {
  return compactCompanies(text)
    .replace(/\b\d{4,}(?:\.\d+)?\b/g, (number) => {
      if (/^(19|20)\d{2}$/.test(number)) return number // a year
      const value = Number(number)
      return value.toLocaleString(undefined, { maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2 })
    })
}

export default {
  name: 'AnswerPanel',

  components: { Button, BridgeReport },

  props: {
    query: { type: String, required: true },
    result: { type: Object, required: true },
    // Its explanation is open in the side panel
    explained: { type: Boolean, default: false },
  },

  // explain: open (or close) how this answer was worked out, in the side panel
  emits: ['open-request', 'explain'],

  data() {
    return {
      showEmpty: false,
      bridgeRequest: null,
    }
  },

  computed: {
    answer() {
      return (
        this.result.agent_response || {
          execution_status: 'REQUEST_ERROR',
          error_message: this.result.error,
          cited_data_rows: [],
        }
      )
    },

    status() {
      return this.answer.execution_status || 'REQUEST_ERROR'
    },

    // mode "not_run" means the question never reached the data at all (no
    // provider configured, database down), which is not the same as a refusal.
    failed() {
      return this.result.mode === 'not_run' && this.status !== 'SUCCESS'
    },

    outcome() {
      if (this.failed) {
        return { tone: 'bad', title: "The question couldn't be answered right now." }
      }
      return OUTCOME[this.status] || OUTCOME.REQUEST_ERROR
    },

    rows() {
      return this.answer.cited_data_rows || []
    },

    // Largest first by the first figure; rows whose figures are all zero fold away
    sortedRows() {
      const index = this.numeric.indexOf(true)
      if (index < 0) return this.rows
      const column = this.columns[index]
      return [...this.rows].sort((a, b) => (Number(b[column]) || 0) - (Number(a[column]) || 0))
    },

    emptyRows() {
      const figures = this.columns.filter((column, index) => this.numeric[index])
      if (!figures.length || this.rows.length < 4) return []
      return this.sortedRows.filter((row) => figures.every((column) => !Number(row[column])))
    },

    shownRows() {
      if (this.showEmpty || !this.emptyRows.length) return this.sortedRows
      return this.sortedRows.filter((row) => !this.emptyRows.includes(row))
    },


    columns() {
      if (this.result.columns && this.result.columns.length) return this.result.columns
      return this.rows[0] ? Object.keys(this.rows[0]) : []
    },

    numeric() {
      return this.columns.map((column) => this.rows.some((row) => typeof row[column] === 'number'))
    },

    decimals() {
      return this.columns.map((column) =>
        this.rows.some((row) => typeof row[column] === 'number' && !Number.isInteger(row[column]))
          ? 2
          : 0,
      )
    },

    text() {
      const narrative = readable(this.answer.narrative_explanation || '')
      if (narrative) return narrative
      if (this.status !== 'SUCCESS') return ''
      return this.rows.length ? 'Here are the figures.' : 'No data matched your question.'
    },

    note() {
      return ['SUCCESS', 'REFORECAST_PROPOSED'].includes(this.status) ? '' : this.answer.error_message || ''
    },

    dsl() {
      return this.answer.generated_dsl || ''
    },

    hasBridge() {
      return /\bBRIDGE\b/i.test(this.dsl)
    },

    // Worded as the Plans tab words the same request
    draftLine() {
      const draft = this.answer.reforecast_draft
      if (!draft) return ''
      return `${driverName(draft.driver_code)} ${driverValue(draft.from_value)} → ${driverValue(draft.to_value)} ` +
        `for ${companiesLabel(draft.companies)}, ${monthsLabel(draft.months)}.`
    },

    driftFlags() {
      return this.answer.drift_flags && this.answer.drift_flags.length
        ? `Recorded vintage drift:\n${JSON.stringify(this.answer.drift_flags, null, 2)}`
        : ''
    },
  },

  watch: {
    // A new answer starts folded, as a fresh question should.
    result() {
      this.showEmpty = false
      this.bridgeRequest = null
    },
  },

  methods: {
    formatCell,
    niceName,

    toggleBridge() {
      this.bridgeRequest = this.bridgeRequest ? null : { dsl: this.dsl, nonce: Date.now() }
    },
  },
}
</script>

<style scoped>
.answer {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.answer__text {
  max-width: 72ch;
  white-space: pre-line;
  color: var(--ink);
  line-height: 1.6;
}
.answer__table {
  width: 100%;
  font-size: 0.875rem;
  text-align: left;
}
.answer__table th {
  padding: 0.375rem 0.5rem;
  font-weight: 500;
  color: var(--ink-soft);
  border-bottom: 1px solid var(--line);
}
.answer__table td {
  padding: 0.375rem 0.5rem;
  white-space: nowrap;
  color: var(--ink);
  border-bottom: 1px solid var(--wash);
}
.answer__more {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--accent);
}
.answer--bad {
  border-color: var(--signal-line);
}
.answer :deep(.border-t),
.answer :deep(.border-b) {
  border-color: var(--line);
}
</style>
