<template>
  <div class="min-h-screen bg-paper">
    <AppHeader v-model="tab" v-bind:counts="counts" />

    <main class="mx-auto max-w-[76rem] px-4 py-6 sm:px-6">
      <!-- A new account sees only that it is waiting; nothing else is mounted -->
      <PendingAccess v-if="$root.user.isPending()" v-on:approved="onApproved" />

      <!-- A superadmin manages access and nothing else: the business screens
           are not mounted for them at all -->
      <AdminUsers
        v-else-if="$root.user.isSuperadmin()"
        v-on:attention="counts.users = $event"
      />

      <template v-else>
      <!-- v-show, not v-if: each tab keeps its state (an answer, a selected
           request) while you look at another -->
      <AskChat v-show="tab === 'ask'" v-on:open-request="openRequest" />

      <!-- Plans and their re-forecasts, together: a re-forecast opens under its plan -->
      <PlanVersions
        v-show="tab === 'plans'"
        v-bind:focus-id="focusRequestId"
        v-on:attention="counts.plans = $event"
        v-on:go-ask="tab = 'ask'"
      />
      </template>
    </main>
  </div>
</template>

<script>
import AdminUsers from '@/components/AdminUsers.vue'
import AppHeader from '@/components/AppHeader.vue'
import AskChat from '@/components/AskChat.vue'
import PendingAccess from '@/components/PendingAccess.vue'
import PlanVersions from '@/components/PlanVersions.vue'
import PageTitle from '@/mixins/PageTitle'

const TABS = ['ask', 'plans', 'users']

// Where a person lands: a superadmin on accounts, deciders on plans (where
// re-forecasts wait for them), everyone else on asking a question. An old
// link to the Re-forecasts tab lands on Plans, where re-forecasts now live.
function landingTab(user, fromUrl) {
  if (user.isSuperadmin()) return 'users'
  const tab = fromUrl === 'reforecasts' ? 'plans' : fromUrl
  if (TABS.includes(tab) && tab !== 'users') return tab
  return user.hasRole('controller') || user.hasRole('cfo') ? 'plans' : 'ask'
}

export default {
  name: 'Home',

  components: { AdminUsers, AppHeader, AskChat, PendingAccess, PlanVersions },

  mixins: [PageTitle],

  data() {
    return {
      tab: landingTab(this.$root.user, this.$route.query.tab),
      counts: { plans: 0, users: 0 },
      // A question that drafted a re-forecast opens its request
      focusRequestId: '',
    }
  },

  watch: {
    // The tab is in the address, so a link or a reload lands on the same place
    tab(value) {
      if (this.$route.query.tab !== value) this.$router.replace({ query: { ...this.$route.query, tab: value } })
    },
  },

  // An old or missing tab in the address is corrected to where the person landed
  mounted() {
    if (this.$route.query.tab !== this.tab) this.$router.replace({ query: { ...this.$route.query, tab: this.tab } })
  },

  methods: {
    // Approved while waiting: land where their new role belongs
    onApproved() {
      this.tab = landingTab(this.$root.user, null)
    },

    openRequest(requestId) {
      this.focusRequestId = ''
      this.$nextTick(() => {
        this.focusRequestId = requestId
        this.tab = 'plans'
      })
    },
  },
}
</script>
