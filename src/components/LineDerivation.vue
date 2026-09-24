<template>
  <!-- One plan line's derivation trace, read as the steps that produced it -->
  <div class="deriv">
    <!-- What the line comes to -->
    <section class="deriv__result">
      <p class="deriv__amount">{{ number(line.amount_functional, 2) }} {{ line.functional_currency }}</p>
      <p class="text-sm text-ink-soft">
        {{ number(line.quantity, 4) }} quantity × {{ number(line.unit_price, 2) }} unit price
      </p>
    </section>

    <!-- A line a driver change moved -->
    <template v-if="method === 'driver_elasticity'">
      <section class="deriv__step">
        <h3 class="deriv__title">What changed</h3>
        <ul class="space-y-3">
          <li v-for="driver in drivers" v-bind:key="driver.key" class="deriv__driver">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-semibold text-ink-main">{{ driver.name }}</span>
              <span class="deriv__tag" v-bind:class="{ 'deriv__tag--direct': driver.direct }">
                {{ driver.direct ? 'Changed directly' : 'Follows from it' }}
              </span>
            </div>
            <p class="deriv__move">
              {{ driver.from }} <span aria-hidden="true">→</span><span class="sr-only">to</span> {{ driver.to }}
              <span class="deriv__change" v-bind:class="driver.change < 0 ? 'deriv__change--down' : 'deriv__change--up'">
                {{ signedPercent(driver.change) }}
              </span>
            </p>
            <p v-if="driver.scope" class="text-sm text-ink-soft">For {{ driver.scope }}</p>
            <p v-if="!driver.direct && driver.formula" class="text-sm text-ink-soft">
              Worked out as <code class="deriv__inline">{{ driver.formula }}</code>
            </p>
          </li>
        </ul>
      </section>

      <section class="deriv__step">
        <h3 class="deriv__title">How it reaches this line</h3>
        <div v-for="binding in bindings" v-bind:key="binding.key" class="deriv__binding">
          <p class="text-ink-mid">
            {{ binding.target }} moves with {{ binding.driver.toLowerCase() }} at a sensitivity of
            <strong>{{ binding.elasticity }}</strong>: a {{ signedPercent(binding.driverChange) }} change in
            {{ binding.driver.toLowerCase() }} becomes {{ signedPercent(binding.lineChange) }} on {{ binding.target.toLowerCase() }}.
          </p>
          <p class="deriv__formula">
            factor = 1 + {{ binding.elasticity }} × ({{ number(binding.ratio, 4) }} − 1) = <strong>{{ number(binding.factor, 6) }}</strong>
          </p>
        </div>
      </section>

      <section class="deriv__step">
        <h3 class="deriv__title">The calculation</h3>
        <table class="deriv__calc">
          <tbody>
            <tr>
              <th scope="row">Quantity before</th>
              <td>{{ number(baseline.quantity, 6) }}</td>
            </tr>
            <tr v-if="factors.quantity">
              <th scope="row">× factor</th>
              <td>{{ number(factors.quantity, 6) }}</td>
            </tr>
            <tr class="deriv__calc-sum">
              <th scope="row">Quantity now</th>
              <td>{{ number(result.quantity, 6) }}</td>
            </tr>
            <tr>
              <th scope="row">Unit price {{ factors.unit_price ? 'before' : '(unchanged)' }}</th>
              <td>{{ number(baseline.unit_price, 6) }}</td>
            </tr>
            <template v-if="factors.unit_price">
              <tr>
                <th scope="row">× factor</th>
                <td>{{ number(factors.unit_price, 6) }}</td>
              </tr>
              <tr class="deriv__calc-sum">
                <th scope="row">Unit price now</th>
                <td>{{ number(result.unit_price, 6) }}</td>
              </tr>
            </template>
            <tr class="deriv__calc-total">
              <th scope="row">Amount = quantity × unit price</th>
              <td>{{ number(result.amount, 2) }} {{ line.functional_currency }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- A line as loaded from the agreed plan, which no driver has moved -->
    <section v-else-if="method === 'seeded_plan'" class="deriv__step">
      <h3 class="deriv__title">Where it comes from</h3>
      <p class="text-ink-mid">
        Loaded from the agreed plan {{ source.plan_version || '' }} as it was first recorded<template v-if="source.revision">
        (revision {{ source.revision }}</template><template v-if="source.scenario">, {{ source.scenario }} scenario</template><template v-if="source.revision">)</template>.
        No driver change has moved this line.
      </p>
      <table class="deriv__calc mt-3">
        <tbody>
          <tr><th scope="row">Quantity</th><td>{{ number(inputs.quantity, 6) }}</td></tr>
          <tr><th scope="row">Unit price</th><td>{{ number(inputs.unit_price, 6) }}</td></tr>
          <tr class="deriv__calc-total">
            <th scope="row">Amount = quantity × unit price</th>
            <td>{{ number(line.amount_functional, 2) }} {{ line.functional_currency }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Any other kind of trace: its inputs, one per row -->
    <section v-else class="deriv__step">
      <h3 class="deriv__title">Inputs</h3>
      <dl class="deriv__pairs">
        <template v-for="[key, value] in genericInputs" v-bind:key="key">
          <dt>{{ niceKey(key) }}</dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
    </section>

    <section class="deriv__step">
      <h3 class="deriv__title">The rule applied</h3>
      <p class="deriv__formula">{{ trace.formula }}</p>
      <p v-if="inputs.assumption" class="deriv__note">{{ sentence(inputs.assumption) }}</p>
      <details class="mt-3">
        <summary class="cursor-pointer text-sm text-ink-soft">Trace as stored</summary>
        <pre class="deriv__raw">{{ JSON.stringify(trace, null, 2) }}</pre>
      </details>
    </section>
  </div>
</template>

<script>
import { companiesLabel, driverName, driverValue, monthsLabel } from '@/utils/labels'

export default {
  name: 'LineDerivation',

  props: {
    // A plan line row as GET /plan-versions/{code}/lines returns it
    line: { type: Object, required: true },
  },

  computed: {
    trace() {
      return this.line.driver_derivation_trace || {}
    },

    method() {
      return this.trace.method || ''
    },

    inputs() {
      return this.trace.inputs || {}
    },

    baseline() {
      return this.inputs.baseline || {}
    },

    result() {
      return this.trace.result || {}
    },

    factors() {
      return this.inputs.applied_factors || {}
    },

    source() {
      return this.inputs.source || {}
    },

    // "utilisation [RTPL1,RTPL2,RTPL3 2026-07..2026-12]" -> the driver, its move and its scope;
    // the driver moved directly first, then the ones that follow from it
    drivers() {
      return Object.entries(this.inputs.drivers || {})
        .map(([key, value]) => ({
          key,
          name: driverName(key.split(' [')[0]),
          direct: Boolean(value.shocked_directly),
          from: driverValue(value.from),
          to: driverValue(value.to),
          change: (Number(value.ratio) - 1) * 100,
          scope: value.scope ? `${companiesLabel(value.scope.companies)}, ${monthsLabel(value.scope.months)}` : '',
          formula: value.formula,
        }))
        .sort((a, b) => Number(b.direct) - Number(a.direct))
    },

    bindings() {
      return (this.inputs.bindings || []).map((binding, index) => ({
        key: `${binding.via}-${index}`,
        driver: driverName(binding.driver),
        target: binding.target === 'unit_price' ? 'Unit price' : 'Quantity',
        elasticity: binding.elasticity,
        ratio: binding.ratio,
        factor: binding.factor,
        driverChange: (Number(binding.ratio) - 1) * 100,
        lineChange: (Number(binding.factor) - 1) * 100,
      }))
    },

    genericInputs() {
      return Object.entries(this.inputs).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : String(value)])
    },
  },

  methods: {
    number(value, digits) {
      const n = Number(value)
      if (!Number.isFinite(n)) return value ?? ''
      return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits })
    },

    signedPercent(value) {
      const n = Number(value)
      const text = `${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
      return n < 0 ? `−${text}` : `+${text}`
    },

    sentence(text) {
      const value = String(text).trim()
      return value.charAt(0).toUpperCase() + value.slice(1) + (/[.!?]$/.test(value) ? '' : '.')
    },

    niceKey(key) {
      return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
    },
  },
}
</script>

<style scoped>
.deriv {
  display: flex;
  flex-direction: column;
}
.deriv__result {
  padding-bottom: 1rem;
}
.deriv__amount {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.deriv__step {
  padding: 1rem 0;
  border-top: 1px solid var(--line);
}
.deriv__title {
  margin-bottom: 0.625rem;
  font-weight: 600;
  color: var(--ink);
}
.deriv__driver {
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
}
.deriv__tag {
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  font-size: 0.75rem;
  color: var(--ink-mid);
}
.deriv__tag--direct {
  border-color: var(--accent-line);
  background: var(--accent-wash);
  color: var(--accent);
}
.deriv__move {
  margin-top: 0.25rem;
  font-size: 1.0625rem;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.deriv__change {
  margin-left: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
}
.deriv__change--down {
  color: var(--signal);
}
.deriv__change--up {
  color: var(--success);
}
.deriv__binding + .deriv__binding {
  margin-top: 0.75rem;
}
.deriv__formula {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--wash);
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.8125rem;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.deriv__inline {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.8125rem;
}
.deriv__note {
  margin-top: 0.625rem;
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
.deriv__calc {
  width: 100%;
  font-size: 0.9375rem;
}
.deriv__calc th {
  padding: 0.375rem 0;
  font-weight: 400;
  text-align: left;
  color: var(--ink-mid);
}
.deriv__calc td {
  padding: 0.375rem 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.deriv__calc-sum th,
.deriv__calc-sum td {
  border-top: 1px solid var(--line);
  font-weight: 600;
  color: var(--ink);
}
.deriv__calc-total th,
.deriv__calc-total td {
  border-top: 2px solid var(--line-strong);
  font-weight: 600;
  color: var(--ink);
}
.deriv__pairs {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  font-size: 0.875rem;
}
.deriv__pairs dt {
  color: var(--ink-soft);
}
.deriv__pairs dd {
  overflow-wrap: anywhere;
}
.deriv__raw {
  margin-top: 0.5rem;
  max-height: 20rem;
  overflow: auto;
  padding: 0.625rem;
  border-radius: 6px;
  background: var(--wash);
  font-size: 0.75rem;
}
</style>
