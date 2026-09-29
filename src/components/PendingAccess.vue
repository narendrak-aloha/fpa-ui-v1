<template>
  <section class="pending" aria-labelledby="pending-title">
    <h2 id="pending-title" class="pending__title">Your account is waiting for approval</h2>
    <p class="pending__lede">
      A superadmin decides what you can do and which companies you see. Until then there is
      nothing to look at, and nothing you need to do.
    </p>

    <!-- A real sequence, so it is numbered -->
    <ol class="steps">
      <li class="step step--done">
        <span class="step__mark" aria-hidden="true">
          <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
        </span>
        <span>
          <span class="step__name">Account created</span>
          <span class="step__detail">{{ $root.user.email }}</span>
        </span>
      </li>
      <li class="step step--now" aria-current="step">
        <span class="step__mark" aria-hidden="true">2</span>
        <span>
          <span class="step__name">A superadmin reviews it</span>
          <span class="step__detail">They choose your role and companies.</span>
        </span>
      </li>
      <li class="step">
        <span class="step__mark" aria-hidden="true">3</span>
        <span>
          <span class="step__name">You start working</span>
          <span class="step__detail">This page opens by itself; no need to sign in again.</span>
        </span>
      </li>
    </ol>

    <div class="pending__check">
      <p class="pending__next" aria-live="polite">
        <template v-if="checking">Checking now…</template>
        <template v-else>Next check in {{ secondsLeft }} s</template>
      </p>
      <Button v-bind:loading="checking" v-on:click="check">Check now</Button>
    </div>
    <ErrorMessage class="mt-3" v-bind:message="errorMessage" />
  </section>
</template>

<script>
import { Button, ErrorMessage } from 'frappe-ui'

const INTERVAL_S = 15

export default {
  name: 'PendingAccess',

  components: { Button, ErrorMessage },

  emits: ['approved'],

  data() {
    return { checking: false, errorMessage: '', intervalId: null, secondsLeft: INTERVAL_S }
  },

  mounted() {
    // One tick a second drives both the countdown and the check
    this.intervalId = this.$root.setAppInterval(() => this.tick(), 1000)
  },

  beforeUnmount() {
    if (this.intervalId) this.$root.clearAppInterval(this.intervalId)
  },

  methods: {
    tick() {
      if (this.checking) return
      this.secondsLeft -= 1
      if (this.secondsLeft <= 0) this.check()
    },

    async check() {
      if (this.checking) return
      this.checking = true
      this.errorMessage = ''
      const response = await this.$root.user.refresh()
      this.checking = false
      this.secondsLeft = INTERVAL_S
      if (response.error) {
        // Declined or disabled: the token no longer works, so the session ends
        if (response.status === 401) await this.$root.logout()
        else this.errorMessage = response.message
        return
      }
      if (!this.$root.user.isPending()) this.$emit('approved')
    },
  },
}
</script>

<style scoped>
.pending {
  max-width: 36rem;
  margin: 2rem auto;
  padding: 2rem;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
}
.pending__title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--ink);
}
.pending__lede {
  margin-top: 0.5rem;
  color: var(--ink-soft);
}
.steps {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 1.5rem 0;
}
.step {
  position: relative;
  display: grid;
  grid-template-columns: 2rem 1fr;
  gap: 0.875rem;
  padding-bottom: 1.25rem;
}
.step:last-child {
  padding-bottom: 0;
}
/* The line joining one step to the next */
.step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: calc(1rem - 1px);
  top: 2rem;
  bottom: 0;
  width: 2px;
  background: var(--line);
}
.step--done::before {
  background: var(--success-line) !important;
}
.step__mark {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 2px solid var(--line-strong);
  background: var(--card);
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--muted);
}
.step__mark svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: var(--card);
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.step--done .step__mark {
  background: var(--success);
  border-color: var(--success);
}
/* Waiting on someone else is amber, as everywhere in the app */
.step--now .step__mark {
  border-color: var(--warning);
  background: var(--warning-wash);
  color: var(--warning);
}
@media (prefers-reduced-motion: no-preference) {
  .step--now .step__mark {
    animation: waiting 2.4s ease-in-out infinite;
  }
  @keyframes waiting {
    50% {
      box-shadow: 0 0 0 5px var(--warning-wash);
    }
  }
}
.step__name {
  display: block;
  padding-top: 0.3rem;
  font-weight: 600;
  color: var(--ink);
}
.step:not(.step--done):not(.step--now) .step__name {
  color: var(--ink-soft);
}
.step__detail {
  display: block;
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.pending__check {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
}
.pending__next {
  font-size: 0.875rem;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
</style>
