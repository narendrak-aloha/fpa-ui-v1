<template>
  <!-- Every step between a question and the figures in its answer -->
  <div class="explain">
    <section class="explain__step">
      <h3 class="explain__title">1. What was assumed</h3>
      <ul class="list-disc space-y-1 pl-5 text-sm text-ink-mid">
        <li v-for="note in assumptions" v-bind:key="note">{{ note }}</li>
      </ul>
    </section>

    <section v-if="dsl" class="explain__step">
      <h3 class="explain__title">2. How your question was understood</h3>
      <p class="explain__lead">The query that was written, clause by clause.</p>
      <pre class="explain__code explain__code--wrap">{{ dsl }}</pre>
      <dl class="explain__pairs">
        <template v-for="[label, description] in dslParts" v-bind:key="label + description">
          <dt>{{ label }}</dt>
          <dd>{{ description }}</dd>
        </template>
      </dl>
    </section>

    <section v-if="sql" class="explain__step">
      <h3 class="explain__title">3. What was run on the database</h3>
      <p class="explain__lead">Every value is a parameter, and the company filter is added by the compiler from your sign-in.</p>
      <pre class="explain__code explain__code--wrap">{{ sql }}</pre>
      <div v-if="params.length" class="mt-2 flex flex-wrap gap-2">
        <span v-for="[key, value] in params" v-bind:key="key" class="explain__param">
          <b>{{ key }} = </b>{{ Array.isArray(value) ? value.join(', ') : String(value) }}
        </span>
      </div>
    </section>

    <section class="explain__step">
      <h3 class="explain__title">4. Details</h3>
      <dl class="explain__pairs">
        <template v-for="[label, value] in details" v-bind:key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
      <details class="mt-3">
        <summary class="cursor-pointer text-sm text-ink-soft">Raw response</summary>
        <pre class="explain__code explain__code--raw">{{ raw }}</pre>
      </details>
    </section>
  </div>
</template>

<script>
import { PROVIDER_NAMES, compactCompanies, describeDuration, explainDsl } from '@/utils/dsl'

export default {
  name: 'AnswerExplanation',

  props: {
    // The /query response, as the answer panel shows it
    result: { type: Object, required: true },
  },

  computed: {
    answer() {
      return this.result.agent_response || { execution_status: 'REQUEST_ERROR', cited_data_rows: [] }
    },

    status() {
      return this.answer.execution_status || 'REQUEST_ERROR'
    },

    dsl() {
      return this.answer.generated_dsl || ''
    },

    dslParts() {
      return this.dsl ? explainDsl(this.dsl) : []
    },

    sql() {
      return this.result.sql || ''
    },

    params() {
      return Object.entries(this.result.params || {})
    },

    assumptions() {
      const assumptions = this.answer.assumptions || []
      return assumptions.length ? assumptions.map(compactCompanies) : ['Nothing needed to be assumed.']
    },

    // Which team member's output carried the executed query, by its stable id
    dslProducer() {
      const trace = this.answer.member_trace
      if (!trace?.produced_by?.id) return ''
      const { id, name } = trace.produced_by
      return name && name !== id ? `${name} (${id})` : id
    },

    // Leader, then each member it delegated to, with the tools each called
    delegation() {
      const trace = this.answer.member_trace
      if (!trace) return ''
      const step = (entry) => `${entry.name || entry.id}${entry.tools?.length ? ` [${entry.tools.join(', ')}]` : ''}`
      return [trace.leader, ...(trace.members || [])].filter(Boolean).map(step).join(' → ')
    },

    details() {
      const mode = this.result.mode
      const answeredBy = mode === 'agno_team'
        ? `AI: ${PROVIDER_NAMES[this.result.provider] || this.result.provider}`
        : mode === 'direct_dsl' ? 'Query run directly, no AI used' : 'Not run'
      const duration = describeDuration(this.result.duration_ms)
      return [
        ['Answered by', answeredBy],
        ...(this.dslProducer ? [['Query written by', this.dslProducer]] : []),
        ...(this.delegation ? [['Team trace', this.delegation]] : []),
        ['Result', this.status],
        ['Rows returned', String((this.answer.cited_data_rows || []).length)],
        ...(duration ? [['Time taken', duration]] : []),
        ...(this.answer.error_message ? [['Message', this.answer.error_message]] : []),
      ]
    },

    raw() {
      return JSON.stringify(this.result, null, 2)
    },
  },
}
</script>

<style scoped>
.explain {
  display: flex;
  flex-direction: column;
}
.explain__step {
  padding: 1rem 0;
  border-top: 1px solid var(--line);
}
.explain__step:first-child {
  border-top: 0;
  padding-top: 0;
}
.explain__title {
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--ink);
}
.explain__lead {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.explain__code {
  overflow-x: auto;
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  background: var(--wash);
  font-size: 0.8125rem;
  color: var(--ink);
}
.explain__code--wrap {
  white-space: pre-wrap;
  font-size: 0.75rem;
}
.explain__code--raw {
  margin-top: 0.5rem;
  max-height: 24rem;
  overflow: auto;
  font-size: 0.75rem;
}
.explain__pairs {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin-top: 0.5rem;
  font-size: 0.875rem;
}
.explain__pairs dt {
  color: var(--ink-soft);
}
.explain__pairs dd {
  color: var(--ink);
  min-width: 0;
  overflow-wrap: anywhere;
}
.explain__param {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  background: var(--wash);
  font-size: 0.75rem;
  color: var(--ink-mid);
}
</style>
