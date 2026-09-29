<template>
  <header class="header">
    <div class="header__inner">
      <p class="header__brand">{{ $root.config.APP_TITLE }}</p>

      <nav class="header__tabs" aria-label="Sections">
        <button
          v-for="tab in tabs"
          v-bind:key="tab.key"
          type="button"
          class="header__tab"
          v-bind:class="{ 'header__tab--on': tab.key === modelValue }"
          v-bind:aria-current="tab.key === modelValue ? 'page' : undefined"
          v-on:click="$emit('update:modelValue', tab.key)"
        >
          {{ tab.label }}
          <span
            v-if="counts[tab.key]"
            class="header__count"
            v-bind:aria-label="`${counts[tab.key]} waiting for you`"
          >{{ counts[tab.key] }}</span>
        </button>
      </nav>

      <div class="header__who">
        <!-- Who the token resolved to: the server's answer, not the browser's claim -->
        <div class="header__id" role="status">
          <p class="header__name">{{ $root.user.fullName }}</p>
          <p class="header__role" v-bind:title="companiesTitle">
            {{ roles }} · {{ scopeLine }}
          </p>
        </div>
        <Button variant="ghost" v-bind:loading="loggingOut" v-on:click="handleLogout">
          Sign out
        </Button>
      </div>
    </div>
  </header>
</template>

<script>
import { Button } from 'frappe-ui'

export default {
  name: 'AppHeader',

  components: { Button },

  props: {
    modelValue: { type: String, required: true },
    // { tabKey: number } of things waiting on this user
    counts: { type: Object, default: () => ({}) },
  },

  emits: ['update:modelValue'],

  data() {
    return {
      loggingOut: false,
    }
  },

  computed: {
    // What this person works in. A waiting account has none; a superadmin has
    // only accounts. The server refuses the rest anyway; this just does not offer it.
    tabs() {
      const user = this.$root.user
      if (user.isPending()) return []
      if (user.isSuperadmin()) return [{ key: 'users', label: 'Users' }]
      return [
        { key: 'ask', label: 'Ask' },
        { key: 'plans', label: 'Plans' },
      ]
    },

    roles() {
      const user = this.$root.user
      if (user.isPending()) return 'Waiting for approval'
      if (user.isSuperadmin()) return 'Superadmin'
      const order = ['cfo', 'controller', 'planner', 'analyst']
      const names = { cfo: 'CFO', controller: 'Controller', planner: 'Planner', analyst: 'Analyst' }
      return order.filter((role) => user.hasRole(role)).map((role) => names[role]).join(', ')
    },

    scopeLine() {
      const user = this.$root.user
      if (user.isPending()) return 'no access yet'
      if (user.isSuperadmin()) return 'manages accounts and access'
      return `sees ${user.companies.length} companies`
    },

    companiesTitle() {
      return `Companies you can see: ${this.$root.user.companies.join(', ')}`
    },
  },

  methods: {
    async handleLogout() {
      this.loggingOut = true
      await this.$root.logout()
      this.loggingOut = false
    },
  },
}
</script>

<style scoped>
.header {
  background: var(--card);
  border-bottom: 1px solid var(--line);
}
.header__inner {
  max-width: 76rem;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0 2rem;
}
.header__brand {
  align-self: center;
  font-weight: 700;
  font-size: 1.125rem;
  letter-spacing: -0.01em;
  color: var(--ink);
  padding: 0.875rem 0;
}
.header__tabs {
  display: flex;
  gap: 0.25rem;
  flex: 1;
}
.header__tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.875rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--ink-soft);
}
.header__tab:hover {
  color: var(--ink);
}
.header__tab--on {
  color: var(--ink);
  font-weight: 600;
}
.header__tab--on::after {
  content: '';
  position: absolute;
  left: 0.5rem;
  right: 0.5rem;
  bottom: -1px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--ink);
}
.header__count {
  min-width: 1.375rem;
  padding: 0 0.375rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--card);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.375rem;
  text-align: center;
}
.header__who {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}
.header__name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--ink);
}
.header__role {
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
.header__id {
  text-align: right;
}
@media (max-width: 720px) {
  .header__inner {
    justify-content: space-between;
  }
  .header__id {
    text-align: left;
  }
  .header__tabs {
    order: 3;
    flex-basis: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .header__tab {
    padding: 0.75rem 0.875rem;
  }
}
</style>
