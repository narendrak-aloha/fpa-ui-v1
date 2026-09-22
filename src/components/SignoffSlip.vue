<template>
  <!-- One slim row of sign-off steps, in order, grouped into phases when the
       steps carry one. Each step is a button that opens its detail below; the
       line under the row says whose step it is and where it stands. -->
  <div class="track">
    <ol class="track__row" v-bind:aria-label="label">
      <li v-for="group in groups" v-bind:key="group.name" class="track__phase">
        <span v-if="group.name" class="track__phase-name">{{ group.name }}</span>
        <ol class="track__steps">
          <li v-for="step in group.steps" v-bind:key="step.key" class="track__item">
            <button
              type="button"
              class="track__step"
              v-bind:class="[`track__step--${step.state}`, { 'track__step--on': step.key === modelValue }]"
              v-bind:aria-pressed="step.key === modelValue"
              v-bind:aria-current="step.state === 'current' ? 'step' : undefined"
              v-bind:title="`${step.title}, ${step.who}: ${step.stamp || fallback(step.state)}`"
              v-on:click="$emit('update:modelValue', step.key)"
            >
              <span class="track__mark" aria-hidden="true">{{ mark(step) }}</span>
              <span class="track__title">{{ step.title }}</span>
            </button>
          </li>
        </ol>
      </li>
    </ol>
    <p v-if="selected" class="track__caption" v-bind:class="`track__caption--${selected.state}`" aria-live="polite">
      <span class="font-medium text-ink-main">{{ selected.title }}</span>
      ({{ selected.who === 'CFO' ? 'CFO' : selected.who.toLowerCase() }}): {{ selected.stamp || fallback(selected.state) }}
    </p>
  </div>
</template>

<script>
// steps: [{ key, title, who, state, stamp, phase? }]
//   state: signed | current | failed | pending | skipped
//   phase: optional group name; consecutive steps with the same phase share it
export default {
  name: 'SignoffSlip',

  props: {
    steps: { type: Array, required: true },
    modelValue: { type: String, default: '' },
    label: { type: String, default: 'Sign-off steps' },
  },

  emits: ['update:modelValue'],

  computed: {
    groups() {
      const groups = []
      for (const step of this.steps) {
        const name = step.phase || ''
        const last = groups[groups.length - 1]
        if (last && last.name === name) last.steps.push(step)
        else groups.push({ name, steps: [step] })
      }
      return groups
    },

    selected() {
      return this.steps.find((step) => step.key === this.modelValue)
    },
  },

  methods: {
    mark(step) {
      if (step.state === 'signed') return '✓'
      if (step.state === 'failed') return '✕'
      return String(this.steps.indexOf(step) + 1)
    },

    fallback(state) {
      return {
        signed: 'done',
        current: 'waiting',
        failed: 'stopped here',
        pending: 'not yet',
        skipped: 'not reached',
      }[state]
    },
  },
}
</script>

<style scoped>
.track {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.track__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}
.track__phase {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}
.track__phase-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-soft);
  padding-left: 0.25rem;
}
.track__steps {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.track__item {
  display: flex;
  align-items: center;
}

.track__step {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0.25rem 0.4375rem 0.25rem 0.25rem;
  border-radius: 999px;
  border: 1px solid transparent;
  color: var(--ink);
  white-space: nowrap;
}
.track__step:hover {
  background: var(--wash);
}
.track__step--on,
.track__step--on:hover {
  background: var(--card);
  border-color: var(--line-strong);
}

.track__mark {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--line-strong);
  color: var(--ink-soft);
  background: var(--card);
}
.track__title {
  font-size: 0.875rem;
  font-weight: 500;
}

.track__step--signed .track__mark {
  background: var(--success);
  border-color: var(--success);
  color: var(--card);
}
.track__step--current .track__mark {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--card);
  box-shadow: 0 0 0 3px var(--accent-wash);
}
.track__step--current .track__title {
  color: var(--accent);
  font-weight: 600;
}
.track__step--failed .track__mark {
  background: var(--signal);
  border-color: var(--signal);
  color: var(--card);
}
.track__step--failed .track__title {
  color: var(--signal);
  font-weight: 600;
}
.track__step--pending .track__title,
.track__step--skipped .track__title {
  color: var(--ink-soft);
}
.track__step--pending .track__mark {
  border-style: dashed;
}
.track__step--skipped .track__mark {
  border-style: dotted;
  color: var(--muted);
}
.track__step--skipped .track__title {
  text-decoration: line-through;
  text-decoration-color: var(--line-strong);
}

.track__caption {
  font-size: 0.875rem;
  color: var(--ink-mid);
  padding-left: 0.25rem;
}
.track__caption--current {
  color: var(--accent);
}
.track__caption--failed {
  color: var(--signal);
}

@media (max-width: 640px) {
  .track__row {
    flex-direction: column;
  }
  .track__steps {
    flex-wrap: wrap;
    row-gap: 0.25rem;
  }
}
</style>
