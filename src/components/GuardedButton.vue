<template>
  <!-- The tooltip hangs off the wrapper: a disabled button does not receive
       hover, so it is made transparent to the pointer and the span takes it. -->
  <Tooltip v-bind:text="blocker" v-bind:disabled="!blocker">
    <span class="inline-flex" v-bind:tabindex="blocker ? 0 : undefined">
      <Button
        v-bind:variant="variant"
        v-bind:theme="theme"
        v-bind:loading="loading"
        v-bind:disabled="Boolean(blocker)"
        v-bind:class="{ 'pointer-events-none': blocker }"
        v-on:click="$emit('click')"
      >
        <slot />
      </Button>
    </span>
  </Tooltip>
</template>

<script>
import { Button, Tooltip } from 'frappe-ui'

export default {
  name: 'GuardedButton',

  components: { Button, Tooltip },

  props: {
    // Why the action is unavailable; empty means it may be pressed
    blocker: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    variant: { type: String, default: 'subtle' },
    theme: { type: String, default: 'gray' },
  },

  emits: ['click'],
}
</script>
