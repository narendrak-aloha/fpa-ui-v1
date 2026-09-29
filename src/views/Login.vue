<template>
  <div class="signin">
    <div class="signin__grid">
      <div class="signin__main">
        <header class="signin__head">
          <h1 class="signin__brand">{{ $root.config.APP_TITLE }}</h1>
          <p class="signin__lede">Ask about the plan, and take re-forecasts through sign-off.</p>
        </header>

        <div class="panel">
          <div class="modes" role="tablist" aria-label="Sign in or create an account">
            <button
              v-for="option in modes"
              v-bind:key="option.key"
              type="button"
              role="tab"
              class="modes__tab"
              v-bind:class="{ 'modes__tab--on': mode === option.key }"
              v-bind:aria-selected="mode === option.key"
              v-on:click="switchMode(option.key)"
            >
              {{ option.label }}
            </button>
          </div>

          <p class="panel__intro">
            {{ mode === 'signup'
              ? 'A new account waits for a superadmin, who chooses your role and companies.'
              : 'Use your work email and password.' }}
          </p>

          <form class="form" novalidate v-on:submit.prevent="submit">
            <label v-if="mode === 'signup'" class="field">
              <span class="field__label">Your name</span>
              <input v-model="displayName" class="field__input" autocomplete="name" v-on:blur="touched.name = true" />
              <span v-if="touched.name && !displayName.trim()" class="field__hint field__hint--bad">Enter the name colleagues know you by.</span>
            </label>

            <label class="field">
              <span class="field__label">Work email</span>
              <input
                ref="email"
                v-model="email"
                class="field__input"
                type="email"
                autocomplete="email"
                inputmode="email"
                v-bind:aria-invalid="touched.email && !!email && !emailValid"
                v-on:blur="touched.email = true"
              />
              <span v-if="touched.email && email && !emailValid" class="field__hint field__hint--bad">That doesn't look like an email address.</span>
            </label>

            <div class="field">
              <label for="signin-password" class="field__label">Password</label>
              <span class="field__pw">
                <input
                  id="signin-password"
                  v-model="password"
                  class="field__input"
                  v-bind:type="showPassword ? 'text' : 'password'"
                  v-bind:autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
                  v-on:keyup="checkCaps"
                  v-on:keydown="checkCaps"
                  v-on:blur="capsOn = false"
                />
                <button
                  type="button"
                  class="field__reveal"
                  v-bind:aria-pressed="showPassword"
                  aria-label="Show password"
                  v-on:click="showPassword = !showPassword"
                >
                  {{ showPassword ? 'Hide' : 'Show' }}
                </button>
              </span>
              <span v-if="capsOn" class="field__hint field__hint--warn">Caps Lock is on.</span>
              <span v-else-if="mode === 'signup'" class="field__hint" v-bind:class="{ 'field__hint--good': passwordLongEnough }">
                {{ passwordLongEnough ? 'Long enough.' : `At least 8 characters (${password.length} so far).` }}
              </span>
            </div>

            <ErrorMessage v-bind:message="errorMessage" />

            <Button
              ref="submit"
              type="submit"
              variant="solid"
              size="lg"
              class="w-full"
              v-bind:loading="submitting"
              v-bind:disabled="!canSubmit"
            >
              {{ mode === 'signup' ? 'Create account' : 'Sign in' }}
            </Button>
          </form>
        </div>
      </div>

      <aside class="demo" aria-labelledby="demo-title">
        <h2 id="demo-title" class="demo__title">Demo accounts</h2>
        <p class="demo__intro">Pick one to fill in the form, then sign in. Each uses the password {{ $root.config.DEMO_PASSWORD }}.</p>
        <ul class="demo__list">
          <li v-for="account in $root.config.DEMO_ACCOUNTS" v-bind:key="account.email">
            <button
              type="button"
              class="demo__item"
              v-bind:class="{ 'demo__item--on': mode === 'signin' && email === account.email }"
              v-bind:aria-pressed="mode === 'signin' && email === account.email"
              v-on:click="fillDemo(account)"
            >
              <span class="demo__mark" aria-hidden="true">{{ account.mark }}</span>
              <span class="demo__text">
                <span class="demo__role">{{ account.label }}</span>
                <span class="demo__email">{{ account.email }}</span>
                <span class="demo__hint">{{ account.hint }}</span>
              </span>
            </button>
          </li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<script>
import { Button, ErrorMessage } from 'frappe-ui'
import PageTitle from '@/mixins/PageTitle'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MIN_PASSWORD = 8

export default {
  name: 'Login',

  components: { Button, ErrorMessage },

  mixins: [PageTitle],

  data() {
    return {
      modes: [
        { key: 'signin', label: 'Sign in' },
        { key: 'signup', label: 'Create account' },
      ],
      mode: 'signin',
      displayName: '',
      email: '',
      password: '',
      showPassword: false,
      capsOn: false,
      touched: { name: false, email: false },
      submitting: false,
      errorMessage: '',
    }
  },

  computed: {
    emailValid() {
      return EMAIL.test(this.email.trim())
    },

    passwordLongEnough() {
      return this.password.length >= MIN_PASSWORD
    },

    canSubmit() {
      if (!this.emailValid || !this.password) return false
      if (this.mode === 'signup') return this.displayName.trim().length > 0 && this.passwordLongEnough
      return true
    },
  },

  mounted() {
    this.$refs.email?.focus()
  },

  methods: {
    switchMode(mode) {
      this.mode = mode
      this.errorMessage = ''
      this.touched = { name: false, email: false }
    },

    checkCaps(event) {
      this.capsOn = typeof event.getModifierState === 'function' && event.getModifierState('CapsLock')
    },

    async submit() {
      if (!this.canSubmit || this.submitting) return
      this.submitting = true
      this.errorMessage = ''
      const error = this.mode === 'signup'
        ? await this.$root.handleSignup(this.email.trim(), this.displayName.trim(), this.password)
        : await this.$root.handlePasswordLogin(this.email.trim(), this.password)
      this.submitting = false
      if (error) this.errorMessage = error
    },

    // Like the example questions on Ask: fills the form, does not submit it.
    // Focus lands on Sign in, so Enter is all that is left to press.
    fillDemo(account) {
      this.mode = 'signin'
      this.email = account.email
      this.password = this.$root.config.DEMO_PASSWORD
      this.errorMessage = ''
      this.touched = { name: false, email: true }
      this.$nextTick(() => this.$refs.submit?.$el?.focus())
    },
  },
}
</script>

<style scoped>
.signin {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1rem;
  background: var(--paper);
}
.signin__grid {
  display: grid;
  gap: 1.5rem;
  width: 100%;
  max-width: 58rem;
  align-items: start;
}
@media (min-width: 820px) {
  .signin__grid {
    grid-template-columns: minmax(0, 1fr) 19rem;
  }
  .demo {
    margin-top: 5.5rem;
  }
}
.signin__head {
  margin-bottom: 1.25rem;
}
.signin__brand {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--ink);
}
.signin__lede {
  margin-top: 0.25rem;
  color: var(--ink-soft);
}

.panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.5rem;
}
.panel__intro {
  margin: 1rem 0 1.25rem;
  font-size: 0.9375rem;
  color: var(--ink-soft);
}
.modes {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 9px;
  background: var(--wash);
}
.modes__tab {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 7px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--ink-soft);
}
.modes__tab--on {
  background: var(--card);
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 0 var(--line);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.field__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink-mid);
}
.field__input {
  width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--paper);
  padding: 0.625rem 0.75rem;
  font-size: 1rem;
  color: var(--ink);
}
.field__input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  background: var(--card);
}
.field__input[aria-invalid='true'] {
  border-color: var(--signal);
}
.field__pw {
  position: relative;
  display: block;
}
.field__pw .field__input {
  padding-right: 4rem;
}
.field__reveal {
  position: absolute;
  right: 0.375rem;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--accent);
}
.field__reveal:hover {
  background: var(--accent-wash);
}
.field__hint {
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
.field__hint--bad {
  color: var(--signal);
}
.field__hint--warn {
  color: var(--warning);
  font-weight: 500;
}
.field__hint--good {
  color: var(--success);
}

/* Demo accounts: suggestions beside the form */
.demo__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}
.demo__intro {
  margin: 0.25rem 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
.demo__list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.demo__item {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  text-align: left;
}
.demo__item:hover {
  border-color: var(--accent-line);
}
.demo__item--on {
  border-color: var(--accent);
  background: var(--accent-wash);
}
.demo__mark {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  background: var(--paper);
  border: 1px solid var(--line);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ink-mid);
}
.demo__item--on .demo__mark {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--card);
}
.demo__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.demo__role {
  font-weight: 600;
  color: var(--ink);
}
.demo__email {
  font-size: 0.8125rem;
  color: var(--ink-mid);
  overflow: hidden;
  text-overflow: ellipsis;
}
.demo__hint {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--ink-soft);
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
