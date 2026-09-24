<template>
  <div class="calculation">
    <p class="calculation__heading">How this row was calculated</p>
    <p v-if="!calculations.length" class="calculation__note">
      This response does not include the source inputs needed to reproduce the calculation.
      No missing quantity, price, or exchange rate has been assumed.
    </p>
    <section v-for="(item, index) in calculations" :key="index" class="calculation__item">
      <h4>{{ item.label }}</h4>
      <p v-if="item.formula" class="calculation__formula">{{ item.formula }}</p>
      <dl v-if="Object.keys(item.inputs || {}).length" class="calculation__inputs">
        <template v-for="(value, label) in item.inputs" :key="label">
          <dt>{{ label }}</dt><dd>{{ value ?? 'Not returned' }}</dd>
        </template>
      </dl>
      <p v-if="item.substitution" class="calculation__worked">{{ item.substitution }} = <strong>{{ item.result }} {{ item.unit }}</strong></p>
      <p v-else class="calculation__worked">Returned result: <strong>{{ item.result ?? 'Not returned' }} {{ item.unit }}</strong></p>
      <p v-for="note in item.notes || []" :key="note" class="calculation__note">{{ note }}</p>
    </section>
  </div>
</template>

<script>
export default {
  name: 'RowCalculation',
  props: { calculations: { type: Array, default: () => [] } },
}
</script>

<style scoped>
.calculation { position: sticky; left: 0; box-sizing: border-box; width: min(76ch, calc(100vw - 5rem)); padding: 0.75rem; color: var(--ink); text-align: left; white-space: normal; }
.calculation__heading { font-weight: 600; margin-bottom: 0.75rem; }
.calculation__item { max-width: 76ch; margin-bottom: 1rem; }
.calculation__item:last-child { margin-bottom: 0; }
h4 { font-size: 0.875rem; font-weight: 600; }
.calculation__formula { margin: 0.375rem 0; line-height: 1.6; }
.calculation__inputs { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.25rem 1rem; margin: 0.5rem 0; }
dt, .calculation__note { color: var(--ink-soft); }
dd, .calculation__worked { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.calculation__worked { padding: 0.5rem 0; border-top: 1px solid var(--line); line-height: 1.6; }
.calculation__note { margin-top: 0.375rem; font-size: 0.8125rem; line-height: 1.5; }
@media (max-width: 640px) { .calculation__inputs { grid-template-columns: 1fr; } dd { margin-bottom: 0.375rem; } }
</style>
