<template>
  <!-- A panel along the right edge of the window. On a wide screen the page
       steps aside for it (index.css, body.side-panel-open), so nothing is
       covered; narrower, it slides over the page above a backdrop. -->
  <Teleport to="body">
    <div v-if="open" class="side-panel__backdrop" aria-hidden="true" v-on:click="$emit('close')"></div>
    <Transition name="side-panel">
      <aside
        v-if="open"
        v-bind:id="panelId"
        class="side-panel"
        role="dialog"
        v-bind:aria-labelledby="`${panelId}-title`"
      >
        <header class="side-panel__head">
          <div class="min-w-0">
            <h2 v-bind:id="`${panelId}-title`" class="text-lg font-semibold text-ink-main">{{ title }}</h2>
            <p v-if="subtitle" class="side-panel__subtitle">{{ subtitle }}</p>
          </div>
          <button ref="close" type="button" class="side-panel__close" aria-label="Close" v-on:click="$emit('close')">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="side-panel__body">
          <slot />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script>
// Only one panel is open at a time across the page; the body class is shared.
export default {
  name: 'SidePanel',

  props: {
    open: { type: Boolean, default: false },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    // The id the opening control names in aria-controls
    panelId: { type: String, default: 'side-panel' },
  },

  // close: the × , Escape, or the backdrop; the parent decides what closing means
  emits: ['close'],

  data() {
    return { returnFocus: null }
  },

  watch: {
    open: {
      immediate: true,
      handler(isOpen, wasOpen) {
        document.body.classList.toggle('side-panel-open', isOpen)
        if (isOpen && !wasOpen) {
          // Focus goes into the panel, and back to what opened it on close
          this.returnFocus = document.activeElement
          this.$nextTick(() => this.$refs.close?.focus())
        } else if (!isOpen && wasOpen) {
          const target = this.returnFocus
          this.returnFocus = null
          this.$nextTick(() => { if (target?.isConnected) target.focus() })
        }
      },
    },
  },

  mounted() {
    document.addEventListener('keydown', this.onKeydown)
  },

  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeydown)
    if (this.open) document.body.classList.remove('side-panel-open')
  },

  methods: {
    onKeydown(event) {
      if (event.key === 'Escape' && this.open) this.$emit('close')
    },
  },
}
</script>

<style scoped>
.side-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  width: var(--drawer-width);
  background: var(--card);
  border-left: 1px solid var(--line-strong);
  box-shadow: -12px 0 24px rgb(29 58 90 / 0.12);
}
.side-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid var(--line);
}
.side-panel__subtitle {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: var(--ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.side-panel__close {
  flex: none;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  font-size: 1.375rem;
  line-height: 1;
  color: var(--ink-mid);
}
.side-panel__close:hover {
  background: var(--wash);
  color: var(--ink);
}
.side-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}
/* Only where the panel covers the page does the page dim behind it */
.side-panel__backdrop {
  display: none;
}
.side-panel-enter-active,
.side-panel-leave-active {
  transition: transform 200ms ease;
}
.side-panel-enter-from,
.side-panel-leave-to {
  transform: translateX(100%);
}
@media (prefers-reduced-motion: reduce) {
  .side-panel-enter-active,
  .side-panel-leave-active {
    transition: none;
  }
}
@media (max-width: 1099px) {
  .side-panel__backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 49;
    background: rgb(29 58 90 / 0.3);
  }
}
</style>
