<template>
  <section class="access">
    <header class="access__head">
      <div>
        <h2 class="access__title">Accounts and access</h2>
        <p class="access__lede">
          Approve new accounts and choose what each person may do and which companies they see.
          As superadmin you manage access only: you hold no business role and see no company data.
        </p>
      </div>
      <Button v-bind:loading="loading" v-on:click="load">Refresh</Button>
    </header>
    <ErrorMessage class="mb-3" v-bind:message="loadError" />

    <div class="access__body">
      <!-- People: filter, search, then the list -->
      <nav class="people" aria-label="People">
        <div class="people__filters" role="tablist" aria-label="Show">
          <button
            v-for="filter in filters"
            v-bind:key="filter.key"
            type="button"
            role="tab"
            class="people__filter"
            v-bind:class="{ 'people__filter--on': view === filter.key, 'people__filter--attention': filter.key === 'waiting' && filter.count }"
            v-bind:aria-selected="view === filter.key"
            v-on:click="view = filter.key"
          >
            {{ filter.label }}
            <span class="people__count">{{ filter.count }}</span>
          </button>
        </div>
        <label class="people__search">
          <span class="sr-only">Search people</span>
          <input
            ref="search"
            v-model="query"
            type="search"
            placeholder="Search name or email"
            v-on:keydown.esc="query = ''"
          />
          <kbd v-if="!query" aria-hidden="true">/</kbd>
        </label>

        <ul class="people__list">
          <li v-for="person in visible" v-bind:key="person.user_id">
            <button
              type="button"
              class="person"
              v-bind:class="{ 'person--on': selectedId === person.user_id }"
              v-bind:aria-current="selectedId === person.user_id ? 'true' : undefined"
              v-on:click="select(person)"
            >
              <span class="person__mark" v-bind:class="`person__mark--${person.status.toLowerCase()}`" aria-hidden="true">
                {{ initials(person.display_name) }}
              </span>
              <span class="person__text">
                <span class="person__name">
                  {{ person.display_name }}<span v-if="isSelf(person)" class="person__you"> (you)</span>
                </span>
                <span class="person__email">{{ person.email }}</span>
                <span class="person__access">{{ summary(person) }}</span>
              </span>
            </button>
          </li>
        </ul>
        <p v-if="!loading && !visible.length" class="people__empty">
          <template v-if="query">No one matches “{{ query }}”.</template>
          <template v-else-if="view === 'waiting'">Nobody is waiting. New sign-ups appear here for you to approve.</template>
          <template v-else>No accounts here.</template>
        </p>
      </nav>

      <!-- The person being decided -->
      <div class="detail">
        <div v-if="!selected" class="detail__empty">
          <p class="detail__empty-title">Choose someone from the list</p>
          <p>
            <template v-if="counts.waiting">
              {{ counts.waiting }} {{ counts.waiting === 1 ? 'person is' : 'people are' }} waiting for approval.
              <button type="button" class="link" v-on:click="openFirstWaiting">Review the first one</button>
            </template>
            <template v-else>Approve sign-ups, change what people can do, or disable an account.</template>
          </p>
        </div>

        <template v-else>
          <!-- Who they are -->
          <div class="who">
            <span class="who__mark" v-bind:class="`person__mark--${selected.status.toLowerCase()}`" aria-hidden="true">
              {{ initials(selected.display_name) }}
            </span>
            <form v-if="editingDetails" class="who__form" v-on:submit.prevent="saveDetails">
              <FormControl ref="nameInput" v-model="nameDraft" label="Name" />
              <FormControl v-model="emailDraft" type="email" label="Email (used to sign in)" />
              <div class="who__form-actions">
                <Button type="submit" variant="solid" v-bind:loading="busy === 'details'" v-bind:disabled="!detailsChanged || !nameDraft.trim() || !emailDraft.trim()">
                  Save details
                </Button>
                <Button type="button" v-on:click="editingDetails = false">Cancel</Button>
              </div>
            </form>
            <div v-else class="who__text">
              <p class="who__name">
                {{ selected.display_name }}
                <StatusPill v-bind:label="statusLabel(selected.status)" v-bind:tone="statusTone(selected.status)" />
              </p>
              <p class="who__email">{{ selected.email }}</p>
              <p class="who__history">{{ history }}</p>
            </div>
            <Button v-if="!editingDetails" class="who__edit" v-on:click="startDetails">Edit name and email</Button>
          </div>

          <!-- Outcome of the last action, shown where it happened -->
          <p v-if="actionStatus" class="notice notice--done" role="status">{{ actionStatus }}</p>
          <ErrorMessage class="mb-3" v-bind:message="actionError" />

          <p v-if="isSelf(selected)" class="notice">
            This is your own account. You can edit your name and email, but not your own access:
            another superadmin changes that.
          </p>

          <template v-else-if="editable">
            <!-- What they may do -->
            <fieldset class="block">
              <legend class="block__title">What they may do</legend>
              <div class="roles">
                <button
                  v-for="role in catalog.roles"
                  v-bind:key="role.role_code"
                  type="button"
                  class="role"
                  v-bind:class="{ 'role--on': draft.roles.includes(role.role_code), 'role--exclusive': role.exclusive }"
                  v-bind:aria-pressed="draft.roles.includes(role.role_code)"
                  v-on:click="toggleRole(role.role_code, !draft.roles.includes(role.role_code))"
                >
                  <span class="role__check" aria-hidden="true">
                    <svg v-if="draft.roles.includes(role.role_code)" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
                  </span>
                  <span class="role__name">{{ roleLabel(role.role_code) }}</span>
                  <span class="role__desc">{{ role.description }}</span>
                </button>
              </div>
            </fieldset>

            <!-- Which companies they see: the coverage map -->
            <fieldset v-if="!draft.roles.includes('superadmin')" class="block">
              <legend class="block__title">
                Which companies they see
                <span class="block__meta">{{ draft.companies.length }} of {{ catalog.companies.length }}</span>
              </legend>
              <div class="block__tools">
                <button type="button" class="link" v-on:click="setAll(true)">Select all</button>
                <button type="button" class="link" v-on:click="setAll(false)">Clear</button>
              </div>
              <div class="coverage">
                <div
                  v-for="country in countries"
                  v-bind:key="country.code"
                  class="country"
                  v-bind:class="`country--${coverageOf(country)}`"
                >
                  <button
                    type="button"
                    class="country__head"
                    v-bind:aria-pressed="coverageOf(country) === 'full'"
                    v-bind:title="coverageOf(country) === 'full' ? `Remove all of ${country.code}` : `Grant all of ${country.code}`"
                    v-on:click="setCountry(country, coverageOf(country) !== 'full')"
                  >
                    <span class="country__code">{{ country.code }}</span>
                    <span class="country__count">{{ chosenIn(country) }} of {{ country.companies.length }}</span>
                  </button>
                  <div class="country__entities">
                    <button
                      v-for="company in country.companies"
                      v-bind:key="company.company_code"
                      type="button"
                      class="entity"
                      v-bind:class="{ 'entity--on': draft.companies.includes(company.company_code) }"
                      v-bind:aria-pressed="draft.companies.includes(company.company_code)"
                      v-bind:title="company.company_name"
                      v-on:click="toggleCompany(company.company_code, !draft.companies.includes(company.company_code))"
                    >
                      {{ company.company_code }}
                    </button>
                  </div>
                </div>
              </div>
            </fieldset>
            <p v-else class="notice">A superadmin sees no company data, so there is nothing to choose here.</p>

            <!-- What will change, before anyone presses a button -->
            <div class="changes" aria-live="polite">
              <p class="block__title">{{ selected.status === 'PENDING' ? 'They will get' : 'What will change' }}</p>
              <ul v-if="changeList.length" class="changes__list">
                <li v-for="line in changeList" v-bind:key="line.text" v-bind:class="`changes__${line.kind}`">
                  <span aria-hidden="true">{{ line.kind === 'add' ? '+' : '−' }}</span>
                  {{ line.text }}
                </li>
              </ul>
              <p v-else class="changes__none">Nothing yet. Pick roles and companies above.</p>
              <p v-if="draftBlocker" class="changes__blocker">{{ draftBlocker }}.</p>
            </div>

            <FormControl v-model="draft.note" label="Note for the audit log (optional)" class="mb-4" placeholder="Why, for whoever reads this later" />
          </template>

          <!-- The decision -->
          <div v-if="!isSelf(selected)" class="actions">
            <template v-if="selected.status === 'PENDING'">
              <Button variant="solid" v-bind:disabled="!!draftBlocker" v-bind:loading="busy === 'approve'" v-on:click="approve">
                Approve with this access
              </Button>
              <Button v-bind:loading="busy === 'reject'" v-on:click="reject">Decline</Button>
            </template>
            <template v-else-if="selected.status === 'ACTIVE'">
              <Button variant="solid" v-bind:disabled="!!draftBlocker || !changed" v-bind:loading="busy === 'save'" v-on:click="save">
                Save access
              </Button>
              <Button v-if="!confirmingDisable" v-on:click="confirmingDisable = true">Disable account</Button>
              <span v-else class="confirm" role="alertdialog" aria-label="Confirm disabling">
                Disable {{ selected.display_name }}? They are signed out everywhere.
                <Button theme="red" variant="solid" v-bind:loading="busy === 'disable'" v-on:click="setEnabled(false)">Disable</Button>
                <Button v-on:click="confirmingDisable = false">Keep active</Button>
              </span>
            </template>
            <template v-else>
              <Button variant="solid" v-bind:loading="busy === 'enable'" v-on:click="setEnabled(true)">
                {{ selected.status === 'REJECTED' ? 'Reconsider and activate' : 'Enable account' }}
              </Button>
            </template>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<script>
import { Button, ErrorMessage, FormControl } from 'frappe-ui'
import StatusPill from '@/components/StatusPill.vue'
import { personName } from '@/utils/labels'

const ROLE_LABELS = { analyst: 'Analyst', planner: 'Planner', controller: 'Controller', cfo: 'CFO', superadmin: 'Superadmin' }
// For the superadmin reading this list, a sign-up waiting on them is
// something that needs them (blue); a closed account is red, as elsewhere.
const STATUS = {
  PENDING: { label: 'Needs approval', tone: 'active' },
  ACTIVE: { label: 'Active', tone: 'done' },
  REJECTED: { label: 'Declined', tone: 'failed' },
  DISABLED: { label: 'Disabled', tone: 'closed' },
}

export default {
  name: 'AdminUsers',

  components: { Button, ErrorMessage, FormControl, StatusPill },

  emits: ['attention'],

  data() {
    return {
      people: [],
      catalog: { roles: [], companies: [] },
      selectedId: null,
      draft: { roles: [], companies: [], note: '' },
      view: 'waiting',
      query: '',
      loading: false,
      loadError: '',
      busy: '',
      editingDetails: false,
      nameDraft: '',
      emailDraft: '',
      confirmingDisable: false,
      actionError: '',
      actionStatus: '',
    }
  },

  computed: {
    humans() {
      return this.people.filter((person) => person.is_human)
    },

    counts() {
      const of = (...statuses) => this.humans.filter((p) => statuses.includes(p.status)).length
      return { waiting: of('PENDING'), active: of('ACTIVE'), closed: of('DISABLED', 'REJECTED') }
    },

    filters() {
      return [
        { key: 'waiting', label: 'Waiting', count: this.counts.waiting },
        { key: 'active', label: 'Active', count: this.counts.active },
        { key: 'closed', label: 'Closed', count: this.counts.closed },
      ]
    },

    visible() {
      const statuses = { waiting: ['PENDING'], active: ['ACTIVE'], closed: ['DISABLED', 'REJECTED'] }[this.view]
      const q = this.query.trim().toLowerCase()
      return this.humans
        .filter((p) => statuses.includes(p.status))
        .filter((p) => !q || p.display_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    },

    detailsChanged() {
      if (!this.selected) return false
      return this.nameDraft.trim() !== this.selected.display_name || this.emailDraft.trim() !== this.selected.email
    },

    selected() {
      return this.people.find((person) => person.user_id === this.selectedId) || null
    },

    countries() {
      const byCountry = new Map()
      for (const company of this.catalog.companies) {
        if (!byCountry.has(company.country_code)) byCountry.set(company.country_code, [])
        byCountry.get(company.country_code).push(company)
      }
      return [...byCountry].map(([code, companies]) => ({ code, companies }))
    },

    editable() {
      return this.selected && ['PENDING', 'ACTIVE'].includes(this.selected.status)
    },

    // The same rules the database enforces, said before the click
    draftBlocker() {
      const { roles, companies } = this.draft
      if (!roles.length) return 'Choose at least one role'
      if (roles.includes('superadmin') && roles.length > 1) return 'A superadmin holds no other role'
      if (!roles.includes('superadmin') && !companies.length) return 'A business role needs at least one company'
      return ''
    },

    changed() {
      if (!this.selected) return false
      const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
      return !same(this.draft.roles, this.selected.roles) || !same(this.draft.companies, this.selected.companies)
    },

    // "Signed up 27 Sept 2026, declined by … on 27 Sept 2026. Note: “…”"
    history() {
      const p = this.selected
      if (!p) return ''
      let text = `Signed up ${this.day(p.created_at)}`
      if (p.status_changed_by) {
        text += `, ${this.statusVerb(p)} by ${this.nameOf(p.status_changed_by)} on ${this.day(p.status_changed_at)}`
      }
      text += '.'
      if (p.status_note) text += ` Note: “${p.status_note}”`
      return text
    },

    // The draft against what they hold now, in words
    changeList() {
      if (!this.selected) return []
      const before = this.selected
      const diff = (next, prev) => [next.filter((x) => !prev.includes(x)), prev.filter((x) => !next.includes(x))]
      const [addRoles, dropRoles] = diff(this.draft.roles, before.roles)
      const [addCos, dropCos] = diff(this.draft.companies, before.companies)
      const names = (codes) => codes.map((c) => this.roleLabel(c)).join(', ')
      const lines = []
      if (addRoles.length) lines.push({ kind: 'add', text: `Role: ${names(addRoles)}` })
      if (dropRoles.length) lines.push({ kind: 'drop', text: `Role: ${names(dropRoles)}` })
      if (addCos.length) lines.push({ kind: 'add', text: this.companiesText(addCos) })
      if (dropCos.length) lines.push({ kind: 'drop', text: this.companiesText(dropCos) })
      return lines
    },
  },

  watch: {
    // A new sign-up while nobody is waiting: switch the list back to it
    'counts.waiting'(now, before) {
      if (now > before) this.view = 'waiting'
    },
  },

  mounted() {
    this.load()
    window.addEventListener('keydown', this.onKey)
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey)
  },

  methods: {
    // "/" jumps to search, as in most lists people already use
    onKey(event) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (event.key === '/' && !typing) {
        event.preventDefault()
        this.$refs.search?.focus()
      }
    },

    async load() {
      this.loading = true
      this.loadError = ''
      const [users, catalog] = await Promise.all([
        this.$root.callAuthenticatedEndpoint('listUsers'),
        this.catalog.roles.length ? Promise.resolve(null) : this.$root.callAuthenticatedEndpoint('getAccessCatalog'),
      ])
      this.loading = false
      if (users.error) {
        this.loadError = users.message
        return
      }
      if (catalog && !catalog.error) this.catalog = catalog.data
      this.people = users.data
      this.$emit('attention', this.counts.waiting)
      // First visit with nobody waiting: show the active people instead
      if (!this.selected && !this.counts.waiting && this.view === 'waiting') this.view = 'active'
      if (this.selected) this.resetDraft(this.selected)
    },

    openFirstWaiting() {
      this.view = 'waiting'
      const first = this.humans.find((p) => p.status === 'PENDING')
      if (first) this.select(first)
    },

    select(person) {
      this.editingDetails = false
      this.confirmingDisable = false
      this.selectedId = person.user_id
      this.actionError = ''
      this.actionStatus = ''
      this.resetDraft(person)
    },

    resetDraft(person) {
      // A new account starts from the least access: analyst, no companies
      const roles = person.roles.length ? [...person.roles] : ['analyst']
      this.draft = { roles, companies: [...person.companies], note: '' }
    },

    toggleRole(role, on) {
      if (role === 'superadmin') {
        // Exclusive: a superadmin has no business role and no companies
        this.draft.roles = on ? ['superadmin'] : []
        if (on) this.draft.companies = []
        return
      }
      const others = this.draft.roles.filter((r) => r !== role && r !== 'superadmin')
      this.draft.roles = on ? [...others, role] : others
    },

    toggleCompany(code, on) {
      const rest = this.draft.companies.filter((c) => c !== code)
      this.draft.companies = on ? [...rest, code] : rest
    },

    setCountry(country, on) {
      const codes = country.companies.map((c) => c.company_code)
      const rest = this.draft.companies.filter((c) => !codes.includes(c))
      this.draft.companies = on ? [...rest, ...codes] : rest
    },

    setAll(on) {
      this.draft.companies = on ? this.catalog.companies.map((c) => c.company_code) : []
    },

    chosenIn(country) {
      return country.companies.filter((c) => this.draft.companies.includes(c.company_code)).length
    },

    coverageOf(country) {
      const chosen = this.chosenIn(country)
      return chosen === 0 ? 'none' : chosen === country.companies.length ? 'full' : 'partial'
    },

    // "Companies: all of PL, RTDE1" — whole countries named as countries
    companiesText(codes) {
      const parts = []
      for (const country of this.countries) {
        const mine = country.companies.map((c) => c.company_code).filter((c) => codes.includes(c))
        if (!mine.length) continue
        parts.push(mine.length === country.companies.length && mine.length > 1 ? `all of ${country.code}` : mine.join(', '))
      }
      return `${codes.length === 1 ? 'Company' : 'Companies'}: ${parts.join(', ')}`
    },

    async act(kind, endpoint, ...args) {
      this.busy = kind
      this.actionError = ''
      this.actionStatus = ''
      const response = await this.$root.callAuthenticatedEndpoint(endpoint, ...args)
      this.busy = ''
      if (response.error) {
        this.actionError = response.message
        return false
      }
      await this.load()
      return true
    },

    startDetails() {
      this.nameDraft = this.selected.display_name
      this.emailDraft = this.selected.email
      this.actionError = ''
      this.actionStatus = ''
      this.editingDetails = true
      this.$nextTick(() => this.$refs.nameInput?.$el?.querySelector('input')?.focus())
    },

    // Only what changed is sent: a name and an email are separate calls, each
    // audited on its own
    async saveDetails() {
      const id = this.selected.user_id
      const name = this.nameDraft.trim()
      const email = this.emailDraft.trim()
      const nameChanged = name !== this.selected.display_name
      const emailChanged = email !== this.selected.email
      if (nameChanged && !(await this.act('details', 'renameUser', id, name))) return
      if (emailChanged && !(await this.act('details', 'changeUserEmail', id, email))) return
      this.editingDetails = false
      this.actionStatus = emailChanged
        ? 'Details saved. They sign in with the new email from now on.'
        : 'Details saved.'
      // Edited yourself: the header shows the new details straight away
      if (id === this.$root.user.userId) await this.$root.user.refresh()
    },

    async approve() {
      const { roles, companies, note } = this.draft
      const name = this.selected.display_name
      if (await this.act('approve', 'approveUser', this.selected.user_id, { roles, companies, note })) {
        this.view = 'active'
        this.actionStatus = `${name} is approved and can sign in and work now.`
      }
    },

    async reject() {
      const name = this.selected.display_name
      if (await this.act('reject', 'rejectUser', this.selected.user_id, this.draft.note)) {
        this.view = 'closed'
        this.actionStatus = `${name}'s request is declined. They cannot sign in.`
      }
    },

    async save() {
      const { roles, companies, note } = this.draft
      if (await this.act('save', 'setUserAccess', this.selected.user_id, { roles, companies, note })) {
        this.actionStatus = 'Access saved. It applies from their next click.'
      }
    },

    async setEnabled(enabled) {
      const name = this.selected.display_name
      if (await this.act(enabled ? 'enable' : 'disable', 'setUserEnabled', this.selected.user_id, enabled, this.draft.note)) {
        this.confirmingDisable = false
        this.view = enabled ? 'active' : 'closed'
        this.actionStatus = enabled ? `${name} is active again.` : `${name} is disabled and signed out everywhere.`
      }
    },

    // The list already holds everyone, so ids are named from it
    nameOf(userId) {
      return this.people.find((person) => person.user_id === userId)?.display_name || personName(userId)
    },

    isSelf(person) {
      return person.user_id === this.$root.user.userId
    },

    initials(name) {
      return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    },

    roleLabel(role) {
      return ROLE_LABELS[role] || role
    },

    // What the last status change was, in words
    statusVerb(person) {
      return { ACTIVE: 'activated', DISABLED: 'disabled', REJECTED: 'declined' }[person.status] || 'changed'
    },

    statusLabel(status) {
      return STATUS[status]?.label || status
    },

    statusTone(status) {
      return STATUS[status]?.tone || 'closed'
    },

    summary(person) {
      if (person.status === 'PENDING') return 'Signed up, no access yet'
      if (person.status !== 'ACTIVE') return 'No access'
      if (person.roles.includes('superadmin')) return 'Superadmin'
      const roles = person.roles.map((r) => this.roleLabel(r)).join(', ') || 'No role'
      const n = person.companies.length
      return `${roles}, ${n} ${n === 1 ? 'company' : 'companies'}`
    },

    day(value) {
      if (!value) return ''
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? String(value).slice(0, 10)
        : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    },
  },
}
</script>

<style scoped>
.access__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.access__title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--ink);
}
.access__lede {
  max-width: 62ch;
  margin-top: 0.25rem;
  color: var(--ink-soft);
}
.access__body {
  display: grid;
  gap: 1.25rem;
  align-items: start;
}
@media (min-width: 900px) {
  .access__body {
    grid-template-columns: 21rem minmax(0, 1fr);
  }
}

/* People list */
.people {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.75rem;
}
@media (min-width: 900px) {
  .people {
    position: sticky;
    top: 1rem;
  }
}
.people__filters {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--wash);
  border-radius: 8px;
}
.people__filter {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ink-soft);
}
.people__filter--on {
  background: var(--card);
  color: var(--ink);
  box-shadow: 0 1px 0 var(--line);
}
.people__count {
  min-width: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--paper);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
.people__filter--attention .people__count {
  background: var(--accent);
  color: var(--card);
}
.people__search {
  position: relative;
  display: block;
  margin: 0.75rem 0 0.5rem;
}
.people__search input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  padding: 0.45rem 2rem 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: var(--ink);
}
.people__search input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.people__search kbd {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  padding: 0 0.35rem;
  font-size: 0.75rem;
  color: var(--muted);
}
.people__list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  max-height: 60vh;
  overflow-y: auto;
}
.people__empty {
  padding: 1rem 0.5rem;
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.person {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
  width: 100%;
  padding: 0.6rem 0.5rem;
  border-radius: 8px;
  text-align: left;
  border-left: 3px solid transparent;
}
.person:hover {
  background: var(--wash);
}
.person--on {
  background: var(--wash);
  border-left-color: var(--accent);
}
.person__mark,
.who__mark {
  display: grid;
  place-items: center;
  border-radius: 999px;
  font-weight: 600;
  background: var(--paper);
  color: var(--ink-mid);
  border: 1px solid var(--line);
}
.person__mark {
  width: 2.25rem;
  height: 2.25rem;
  font-size: 0.8125rem;
}
.person__mark--pending {
  background: var(--accent-wash);
  border-color: var(--accent-line);
  color: var(--accent);
}
.person__mark--disabled,
.person__mark--rejected {
  color: var(--muted);
}
.person__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.person__name {
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.person__you {
  font-weight: 400;
  color: var(--ink-soft);
}
.person__email,
.person__access {
  font-size: 0.8125rem;
  color: var(--ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.person__access {
  color: var(--ink-mid);
}

/* Detail */
.detail {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 1.5rem;
  min-height: 20rem;
}
.detail__empty {
  max-width: 42ch;
  margin: 4rem auto;
  text-align: center;
  color: var(--ink-soft);
}
.detail__empty-title {
  margin-bottom: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink);
}
.link {
  color: var(--accent);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.who {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: start;
  padding-bottom: 1.25rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--line);
}
.who__mark {
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.125rem;
}
.who__name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
}
.who__email {
  margin-top: 0.125rem;
  color: var(--ink-mid);
}
.who__history {
  margin-top: 0.375rem;
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.who__form {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}
.who__form-actions {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}
@media (max-width: 640px) {
  .who {
    grid-template-columns: 3rem minmax(0, 1fr);
  }
  .who__edit {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
.notice {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink-mid);
}
.notice--done {
  background: var(--success-wash);
  border: 1px solid var(--success-line);
  color: var(--success);
  font-weight: 500;
}
@media (prefers-reduced-motion: no-preference) {
  .notice--done {
    animation: arrive 0.35s ease-out;
  }
  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
}

.block {
  margin-bottom: 1.5rem;
}
.block__title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  margin-bottom: 0.625rem;
  font-weight: 600;
  color: var(--ink);
}
.block__meta {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.block__tools {
  display: flex;
  gap: 1rem;
  margin: -0.25rem 0 0.625rem;
  font-size: 0.875rem;
}

/* Roles as choices you can see */
.roles {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
}
.role {
  display: grid;
  grid-template-columns: 1.25rem 1fr;
  column-gap: 0.6rem;
  row-gap: 0.125rem;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  text-align: left;
}
.role:hover {
  border-color: var(--accent-line);
}
.role--on {
  background: var(--accent-wash);
  border-color: var(--accent);
}
.role--exclusive {
  border-style: dashed;
}
.role__check {
  grid-row: span 2;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.1rem;
  border: 1.5px solid var(--line-strong);
  border-radius: 5px;
  background: var(--card);
}
.role--on .role__check {
  background: var(--accent);
  border-color: var(--accent);
}
.role__check svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--card);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.role__name {
  font-weight: 600;
  color: var(--ink);
}
.role__desc {
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--ink-soft);
}

/* The coverage map: one tile per country, its entities light up */
.coverage {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
}
.country {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  overflow: hidden;
}
.country--partial {
  border-color: var(--accent-line);
}
.country--full {
  border-color: var(--accent);
  background: var(--accent-wash);
}
.country__head {
  display: flex;
  width: 100%;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.5rem 0.625rem 0.25rem;
  text-align: left;
}
.country__code {
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ink);
}
.country--none .country__code {
  color: var(--ink-soft);
}
.country__count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-soft);
}
.country__entities {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem 0.5rem;
}
.entity {
  padding: 0.125rem 0.45rem;
  border-radius: 5px;
  border: 1px solid var(--line);
  background: var(--card);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink-soft);
}
.entity:hover {
  border-color: var(--accent-line);
}
.entity--on {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--card);
}

/* What will change */
.changes {
  margin-bottom: 1rem;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--paper);
}
.changes__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.changes__list li {
  display: flex;
  gap: 0.5rem;
  font-size: 0.9375rem;
}
.changes__list li span {
  width: 1rem;
  font-weight: 700;
}
.changes__add {
  color: var(--success);
}
.changes__drop {
  color: var(--signal);
}
.changes__none,
.changes__blocker {
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.changes__blocker {
  margin-top: 0.5rem;
  color: var(--warning);
  font-weight: 500;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}
.confirm {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem 0.375rem 0.875rem;
  border-radius: 8px;
  background: var(--signal-wash);
  border: 1px solid var(--signal-line);
  color: var(--signal);
  font-size: 0.875rem;
  font-weight: 500;
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
