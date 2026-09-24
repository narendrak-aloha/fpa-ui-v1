<template>
  <details class="pl-3" v-bind:open="depth === 0">
    <summary class="cursor-pointer py-1 text-sm text-ink-mid">
      <span class="font-medium text-ink-main">{{ label }}</span>: change {{ change }}
      <span v-if="!node.ties" class="text-signal">(does not add up)</span>
    </summary>

    <div class="py-1">
      <Button
        v-bind:variant="selected ? 'solid' : 'subtle'"
        v-on:click="$emit('select', node)"
      >
        {{ selected ? 'Showing above' : 'Show above' }}
      </Button>
    </div>

    <!-- Children render only once the parent is open, so a wide rollup does
         not build thousands of rows the moment a report arrives. -->
    <BridgeNode
      v-for="child in node.children"
      v-bind:key="child.path.join('|')"
      v-bind:node="child"
      v-bind:depth="depth + 1"
      v-bind:selected-path="selectedPath"
      v-on:select="$emit('select', $event)"
    />
  </details>
</template>

<script>
import { Button } from 'frappe-ui'

export default {
  name: 'BridgeNode',

  components: { Button },

  props: {
    node: { type: Object, required: true },
    depth: { type: Number, default: 0 },
    selectedPath: { type: String, default: '' },
  },

  emits: ['select'],

  computed: {
    label() {
      return this.node.path.join(' / ') || 'Total'
    },

    change() {
      const number = Number(this.node.gap)
      const text = Math.abs(number).toLocaleString('en-US', { maximumFractionDigits: 0 })
      return `${number > 0 ? '+' : number < 0 ? '−' : ''}${text} USD`
    },

    selected() {
      return this.selectedPath === this.node.path.join('|')
    },
  },
}
</script>
