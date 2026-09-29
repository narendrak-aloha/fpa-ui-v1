<template>
  <!-- A dialog over the whole window, for content that needs the room -->
  <Teleport to="body">
    <Transition name="full-dialog">
      <div
        v-if="open"
        ref="dialog"
        class="full-dialog"
        role="dialog"
        aria-modal="true"
        v-bind:aria-labelledby="`${dialogId}-title`"
        v-on:keydown="onKeydown"
      >
        <header class="full-dialog__head">
          <div class="min-w-0">
            <h2 v-bind:id="`${dialogId}-title`" class="text-xl font-semibold text-ink-main">{{ title }}</h2>
            <p v-if="subtitle" class="mt-1 text-sm text-ink-soft">{{ subtitle }}</p>
          </div>
          <button ref="close" type="button" class="full-dialog__close" v-on:click="$emit('close')">
            <span aria-hidden="true">×</span> Close
          </button>
        </header>
        <div class="full-dialog__body">
          <div class="full-dialog__content">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default {
  name: 'FullScreenDialog',

  props: {
    open: { type: Boolean, default: false },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    dialogId: { type: String, default: 'full-dialog' },
  },

  // close: the Close button or Escape; the parent decides what closing means
  emits: ['close'],

  data() {
    return { returnFocus: null }
  },

  watch: {
    open: {
      immediate: true,
      handler(isOpen, wasOpen) {
        // The page behind does not scroll while the dialog covers it
        document.documentElement.classList.toggle('full-dialog-open', isOpen)
        if (isOpen && !wasOpen) {
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

  beforeUnmount() {
    if (this.open) document.documentElement.classList.remove('full-dialog-open')
  },

  methods: {
    // Escape closes; Tab stays inside the dialog while it is open
    onKeydown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        this.$emit('close')
        return
      }
      if (event.key !== 'Tab') return
      const items = [...this.$refs.dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
  },
}
</script>

<style scoped>
.full-dialog {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: var(--paper);
}
.full-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem max(1rem, calc((100vw - 76rem) / 2));
  background: var(--card);
  border-bottom: 1px solid var(--line);
}
.full-dialog__close {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  font-size: 0.875rem;
  color: var(--ink);
  background: var(--card);
}
.full-dialog__close span {
  font-size: 1.125rem;
  line-height: 1;
}
.full-dialog__close:hover {
  background: var(--wash);
}
.full-dialog__body {
  flex: 1;
  overflow-y: auto;
}
.full-dialog__content {
  max-width: 76rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}
.full-dialog-enter-active,
.full-dialog-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.full-dialog-enter-from,
.full-dialog-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
@media (prefers-reduced-motion: reduce) {
  .full-dialog-enter-active,
  .full-dialog-leave-active {
    transition: none;
  }
}
</style>
