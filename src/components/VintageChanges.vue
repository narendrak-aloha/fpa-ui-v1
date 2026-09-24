<template>
  <section class="vintages" aria-label="Recorded vintage changes">
    <h3 class="vintages__title">Recorded vintage changes</h3>
    <article v-for="(flag, index) in flags" :key="index" class="vintages__entry">
      <p class="vintages__comparison">
        <strong>{{ vintageLabel(flag.left) }}</strong>
        <span aria-hidden="true"> → </span>
        <strong>{{ vintageLabel(flag.right) }}</strong>
      </p>
      <p class="vintages__note">{{ flag.drift === false ? 'No change recorded between these ledger closes.' : 'Changes recorded between these ledger closes.' }}</p>
      <dl class="vintages__details">
        <template v-if="flag.left?.rows != null || flag.right?.rows != null">
          <dt>Rows compared</dt><dd>{{ number(flag.left?.rows) }} → {{ number(flag.right?.rows) }}</dd>
        </template>
        <template v-if="flag.left?.closed_at || flag.right?.closed_at">
          <dt>Closed on</dt><dd>{{ date(flag.left?.closed_at) }} → {{ date(flag.right?.closed_at) }}</dd>
        </template>
        <template v-if="flag.scope?.length">
          <dt>Companies</dt><dd>{{ flag.scope.length > 4 ? `${flag.scope.length} companies` : flag.scope.join(', ') }}</dd>
        </template>
      </dl>
      <div v-if="metrics(flag).length" class="vintages__scroll">
        <table class="vintages__table">
          <thead><tr><th>Metric</th><th>{{ vintageLabel(flag.left) }}</th><th>{{ vintageLabel(flag.right) }}</th><th>Change</th></tr></thead>
          <tbody>
            <tr v-for="metric in metrics(flag)" :key="metric">
              <th scope="row">{{ niceName(metric) }}</th>
              <td>{{ number(flag.left?.totals?.[metric]) }}</td>
              <td>{{ number(flag.right?.totals?.[metric]) }}</td>
              <td>{{ number(flag.deltas?.[metric], true) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="vintages__note">Metric totals were not returned for this comparison.</p>
    </article>
  </section>
</template>

<script>
import { niceName } from '@/utils/dsl'

export default {
  name: 'VintageChanges',
  props: { flags: { type: Array, default: () => [] } },
  methods: {
    niceName,
    vintageLabel(side) { return side?.vintage == null ? 'Vintage not returned' : `Vintage ${side.vintage}` },
    date(value) { return value ? String(value).slice(0, 10) : 'Not returned' },
    metrics(flag) { return [...new Set([...Object.keys(flag.left?.totals || {}), ...Object.keys(flag.right?.totals || {}), ...Object.keys(flag.deltas || {})])] },
    number(value, signed = false) {
      if (value == null || value === '') return '—'
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) return '—'
      return (signed && numeric > 0 ? '+' : '') + numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })
    },
  },
}
</script>

<style scoped>
.vintages__title { font-weight: 600; color: var(--ink); }
.vintages__entry { padding: 0.75rem 0; border-bottom: 1px solid var(--line); }
.vintages__entry:last-child { border-bottom: 0; padding-bottom: 0; }
.vintages__comparison { font-size: 0.875rem; color: var(--ink); }
.vintages__note { margin-top: 0.375rem; font-size: 0.8125rem; color: var(--ink-soft); }
.vintages__details { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 0.25rem 1rem; margin: 0.5rem 0; font-size: 0.8125rem; }
.vintages__details dt { color: var(--ink-soft); }
.vintages__details dd { overflow-wrap: anywhere; color: var(--ink); }
.vintages__scroll { overflow-x: auto; margin-top: 0.5rem; }
.vintages__table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; color: var(--ink); }
.vintages__table th, .vintages__table td { padding: 0.5rem; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vintages__table thead th { font-weight: 500; color: var(--ink-soft); }
.vintages__table th:first-child { text-align: left; }
.vintages__table tbody th { font-weight: 400; }
</style>
