<template>
  <!-- A token restored from this tab is confirmed with the server before any
       screen renders, so every screen sees the real roles, never a guess -->
  <RouterView v-if="ready" />
</template>

<script>
// Global state lives here and is reached from any component via this.$root.
// No Pinia/Vuex: add shared state to data() and shared actions to methods.
import { useTheme } from 'frappe-ui'
import FpaApi from '@/classes/FpaApi'
import UserPermissions from '@/classes/UserPermissions'
import appConfig from '@/config/appConfig'

const api = new FpaApi()

export default {
  name: 'App',

  // One theme only (src/index.css). frappe-ui switches palettes on
  // [data-theme] and would follow a dark OS setting, so pin it to light.
  setup() {
    const { setTheme } = useTheme()
    setTheme('light')
  },

  data() {
    return {
      // FpaApi instance. All HTTP calls app-wide go through here.
      api: api,

      // UserPermissions instance: the logged-in user's session
      user: new UserPermissions(api),

      // App-wide constants from config/appConfig.js
      config: appConfig,

      // Interval IDs registered through setAppInterval(), cleared on logout
      intervalIds: [],

      // False until a restored session has been checked with /v1/me
      ready: false,
    }
  },

  async created() {
    if (this.user.isAuthenticated()) {
      const response = await this.user.authenticate(this.user.token)
      if (response.error && this.$route.name !== 'Login') {
        this.$router.push({ name: 'Login' })
      }
    }
    this.ready = true
  },

  beforeUnmount() {
    this.clearAppIntervals()
  },

  methods: {
    // Calls an FpaApi method and handles a dead token in one place.
    // Usage: const response = await this.$root.callAuthenticatedEndpoint('getPlanVersion', code)
    //
    // Only 401 ends the session: it means the token itself is not accepted.
    // A 403 is this person being refused this operation — an analyst reading a
    // plan version, say — which is an answer to show them, not a reason to
    // sign them out.
    async callAuthenticatedEndpoint(endpoint, ...args) {
      const response = await this.api[endpoint](...args)
      if (response.error && response.status === 401) {
        await this.logout()
      }
      return response
    },

    // Resolves to null on success, or an error message string.
    // The token is the credential: authenticate() is a /v1/me call with it.
    async handleLogin(token) {
      const response = await this.user.authenticate(token)
      if (response.error) {
        return response.message
      }
      const redirect = this.$route.query.redirect
      this.$router.push(typeof redirect === 'string' ? redirect : { name: 'Home' })
      return null
    },

    // Email and password, or a new account (which starts PENDING)
    async handlePasswordLogin(email, password) {
      const response = await this.user.signIn(email, password)
      return response.error ? response.message : this.afterSignIn()
    },

    async handleSignup(email, displayName, password) {
      const response = await this.user.signUp(email, displayName, password)
      return response.error ? response.message : this.afterSignIn()
    },

    afterSignIn() {
      const redirect = this.$route.query.redirect
      this.$router.push(typeof redirect === 'string' ? redirect : { name: 'Home' })
      return null
    },

    async logout() {
      this.clearAppIntervals()
      await this.user.logout()
      if (this.$route.name !== 'Login') {
        this.$router.push({ name: 'Login' })
      }
    },

    // setInterval that is cleared automatically on logout
    setAppInterval(callback, ms) {
      const id = setInterval(callback, ms)
      this.intervalIds.push(id)
      return id
    },

    clearAppInterval(id) {
      clearInterval(id)
      this.intervalIds = this.intervalIds.filter((intervalId) => intervalId !== id)
    },

    clearAppIntervals() {
      this.intervalIds.forEach((id) => clearInterval(id))
      this.intervalIds = []
    },
  },
}
</script>
