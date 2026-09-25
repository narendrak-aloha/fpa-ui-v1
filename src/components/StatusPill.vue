<template>
  <span class="status-pill" v-bind:class="`status-pill--${tone}`">{{ label }}</span>
</template>

<script>
// A state shown in words, with its tone carried by a real colour, one per
// meaning: done is green, active (needs you / in progress) is blue, waiting
// on someone else is amber, closed is a plain neutral outline, and failed is
// red. Each colour appears only for its own meaning, nowhere else.
export default {
  name: 'StatusPill',

  props: {
    label: { type: String, required: true },
    tone: { type: String, default: 'waiting' },
  },
}
</script>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.125rem 0.625rem;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.4;
}
.status-pill--done {
  background: var(--success);
  color: var(--card);
}
.status-pill--active {
  background: var(--accent-wash);
  border-color: var(--accent-line);
  color: var(--accent);
}
.status-pill--waiting {
  background: var(--warning-wash);
  border-color: var(--warning-line);
  color: var(--warning);
}
.status-pill--closed {
  border-color: var(--line-strong);
  color: var(--ink-soft);
}
.status-pill--failed {
  background: var(--signal-wash);
  border-color: var(--signal-line);
  color: var(--signal);
}
</style>
