<template>
  <div class="chat">
    <!-- Left: every question this person has asked, newest first -->
    <aside class="chat__history" v-bind:class="{ 'chat__history--open': historyOpen }" aria-label="Your questions">
      <div class="chat__history-head">
        <h2 class="text-lg font-semibold text-ink-main">
          <!-- On a phone the list folds away so the conversation comes first -->
          <button
            type="button"
            class="chat__history-toggle"
            v-bind:aria-expanded="historyOpen"
            v-on:click="historyOpen = !historyOpen"
          >
            Your questions ({{ history.length }}) <span aria-hidden="true">{{ historyOpen ? '▾' : '▸' }}</span>
          </button>
          <span class="chat__history-title">Your questions</span>
        </h2>
        <Button variant="subtle" v-bind:disabled="!messages.length || pending" v-on:click="newConversation">New conversation</Button>
      </div>
      <div class="chat__history-body">
      <input
        v-model="search"
        type="search"
        class="chat__search"
        placeholder="Search your questions"
        aria-label="Search your questions"
      />
      <ErrorMessage class="px-3" v-bind:message="historyError" />
      <p v-if="!history.length && !historyError" class="px-3 py-2 text-sm text-ink-soft">
        {{ search ? 'No question matches that.' : 'Questions you ask appear here, so you can open them again.' }}
      </p>
      <div v-for="group in historyGroups" v-bind:key="group.title">
        <p class="chat__day">{{ group.title }}</p>
        <ul>
          <li v-for="item in group.items" v-bind:key="item.ask_id">
            <button
              type="button"
              class="chat__past"
              v-bind:class="{ 'chat__past--on': shownIds.has(item.ask_id) }"
              v-bind:disabled="pending"
              v-on:click="openPast(item)"
            >
              <span class="chat__past-question">{{ item.question }}</span>
              <span class="chat__past-meta">
                {{ clock(item.created_at) }}<template v-if="pastNote(item)">, {{ pastNote(item) }}</template>
              </span>
            </button>
          </li>
        </ul>
      </div>
      </div>
    </aside>

    <!-- Right: the conversation, and where the next question is typed -->
    <section class="chat__main" aria-label="Conversation">
      <div class="chat__messages" aria-live="polite">
        <!-- Nothing asked yet: what can be asked -->
        <div v-if="!messages.length" class="chat__empty">
          <h2 class="text-2xl font-semibold text-ink-main">Ask about the numbers</h2>
          <p class="max-w-[60ch] text-ink-mid">
            Ask in plain words, and see the answer, the figures behind it and how it was worked out.
            <template v-if="user.hasRole('planner')">You can also ask for a re-forecast, which you then confirm.</template>
          </p>
          <ul class="chat__suggestions">
            <li v-for="example in examples" v-bind:key="example.text">
              <button type="button" class="chat__suggestion" v-on:click="useExample(example.text)">
                <span v-bind:class="{ 'font-mono text-sm': example.code }">{{ example.text }}</span>
                <span v-if="example.note" class="chat__suggestion-note">{{ example.note }}</span>
              </button>
            </li>
          </ul>
        </div>

        <article
          v-for="message in messages"
          v-bind:key="message.key"
          v-bind:ref="(el) => setMessageRef(message.key, el)"
          class="chat__turn"
          v-bind:class="{ 'chat__turn--explained': message.key === explainKey }"
        >
          <div class="chat__question-row">
            <p class="chat__question">{{ message.question }}</p>
            <p class="chat__when">
              {{ message.fromHistory ? `Asked ${when(message.askedAt)}` : clock(message.askedAt) }}
            </p>
          </div>

          <div v-if="message.pending" class="chat__working" role="status">
            <LoadingIndicator class="h-4 w-4" />
            <span> Working on your answer, {{ elapsedSeconds }} s. </span>
          </div>

          <div v-else-if="message.withheld" class="chat__withheld">
            <p class="text-ink-mid">
              This answer is hidden: it was worked out for companies you can no longer see. Ask again to get
              today's answer for the companies you have now.
            </p>
            <Button v-bind:disabled="pending" v-on:click="send(message.question)">Ask again</Button>
          </div>

          <template v-else>
            <AnswerPanel
              v-bind:query="message.question"
              v-bind:result="message.result"
              v-bind:explained="message.key === explainKey"
              v-on:open-request="$emit('open-request', $event)"
              v-on:explain="toggleExplain(message.key)"
            />
            <div class="chat__after">
              <button type="button" class="chat__link" v-bind:disabled="pending" v-on:click="send(message.question)">
                Ask again with today's data
              </button>
              <button type="button" class="chat__link" v-bind:disabled="pending" v-on:click="editQuestion(message.question)">
                Edit and ask
              </button>
            </div>
          </template>
        </article>
      </div>

      <!-- The composer stays at the bottom of the window -->
      <form class="chat__composer" v-on:submit.prevent="send()">
        <label for="chat-question" class="sr-only">Your question</label>
        <textarea
          id="chat-question"
          ref="field"
          v-model="draft"
          class="chat__input"
          rows="1"
          maxlength="8000"
          placeholder="Ask about the numbers, e.g. What was services revenue by practice in Q2 2026?"
          v-on:input="fitField"
          v-on:keydown="onKeydown"
        ></textarea>
        <div class="chat__bar">
          <details class="chat__scope" v-bind:open="scopeOpen" v-on:toggle="scopeOpen = $event.target.open">
            <summary>{{ scopeLabel }}</summary>
            <div class="chat__scope-menu">
              <label class="chat__scope-all">
                <input type="checkbox" v-bind:checked="allSelected" v-on:change="selectAll($event.target.checked)" />
                All my companies ({{ user.companies.length }})
              </label>
              <div v-for="group in companyGroups" v-bind:key="group.country" class="chat__scope-group">
                <label class="chat__scope-country">
                  <input
                    type="checkbox"
                    v-bind:checked="group.codes.every((code) => chosen.includes(code))"
                    v-on:change="toggleCountry(group, $event.target.checked)"
                  />
                  {{ group.name }}
                </label>
                <label v-for="code in group.codes" v-bind:key="code" class="chat__scope-option">
                  <input v-model="chosen" type="checkbox" v-bind:value="code" />
                  {{ code }}
                </label>
              </div>
            </div>
          </details>
          <div class="chat__provider-field">
          <label class="chat__provider">
            Provider
            <select v-model="provider" :disabled="pending" :aria-invalid="Boolean(providerError)" :aria-describedby="providerError ? 'chat-provider-error' : undefined">
              <option v-for="option in $root.config.PROVIDERS" v-bind:key="option.id" v-bind:value="option.id">
                {{ option.label }}
              </option>
            </select>
          </label>
          <p v-if="providerError" id="chat-provider-error" class="chat__provider-error" role="alert">{{ providerError }}</p>
          </div>
          <Button type="submit" variant="solid" class="ml-auto" v-bind:disabled="!canSend" v-bind:loading="pending">Ask</Button>
        </div>
        <p class="chat__hint">Each question is answered on its own. Enter to ask, Shift+Enter for a new line.</p>
      </form>
    </section>

    <!-- How an answer was worked out, in a panel along the right edge -->
    <SidePanel
      v-bind:open="Boolean(explained)"
      title="How this answer was worked out"
      v-bind:subtitle="explained ? `“${explained.question}”` : ''"
      panel-id="answer-explanation"
      v-on:close="explainKey = ''"
    >
      <AnswerExplanation v-if="explained" v-bind:result="explained.result" />
    </SidePanel>
  </div>
</template>

<script>
import { Button, ErrorMessage, LoadingIndicator } from 'frappe-ui'
import AnswerExplanation from '@/components/AnswerExplanation.vue'
import AnswerPanel from '@/components/AnswerPanel.vue'
import SidePanel from '@/components/SidePanel.vue'

const COUNTRIES = {
  AE: 'UAE', AU: 'Australia', CA: 'Canada', DE: 'Germany', IN: 'India',
  PL: 'Poland', SG: 'Singapore', UK: 'United Kingdom', US: 'United States',
}

export default {
  name: 'AskChat',

  components: { AnswerExplanation, AnswerPanel, Button, ErrorMessage, LoadingIndicator, SidePanel },

  // open-request: a question drafted a re-forecast; open it to confirm
  emits: ['open-request'],

  data() {
    return {
      // [{ key, question, askedAt, result, pending, withheld, fromHistory, askId }]
      messages: [],
      draft: '',
      chosen: [],
      scopeOpen: false,
      provider: this.$root.config.PROVIDERS[0].id,
      providerStatus: [],
      history: [],
      historyError: '',
      historyOpen: false,
      // The message whose explanation is open in the side panel
      explainKey: '',
      search: '',
      searchTimer: null,
      startedAt: 0,
      now: Date.now(),
      clockTimer: null,
      messageRefs: {},
    }
  },

  computed: {
    user() {
      return this.$root.user
    },

    explained() {
      return this.messages.find((message) => message.key === this.explainKey && message.result) || null
    },

    pending() {
      return this.messages.some((message) => message.pending)
    },

    canSend() {
      return this.draft.trim().length > 0 && !this.pending && !this.providerError
    },

    elapsedSeconds() {
      return Math.max(0, Math.round((this.now - this.startedAt) / 1000))
    },

    shownIds() {
      return new Set(this.messages.map((message) => message.askId).filter(Boolean))
    },

    providerError() {
      if (/^SELECT\b/i.test(this.draft.trim())) return ''
      const option = this.$root.config.PROVIDERS.find(option => option.id === this.provider)
      const status = this.providerStatus.find(status => status.id === this.provider)
      return option?.apiKeyEnv && status?.configured === false
        ? `API key is missing for ${option.label}. Set ${option.apiKeyEnv}.`
        : ''
    },

    // What this person can actually do, in the order they would try it: the
    // re-forecast first for a planner, because it is the only one that writes
    // anything, then the bridge, which is the answer with a shape to it.
    examples() {
      const config = this.$root.config
      const list = []
      if (this.user.hasRole('planner')) {
        list.push({ text: config.REFORECAST_EXAMPLE, note: 'Drafts a re-forecast for you to confirm' })
      }
      list.push(...config.BRIDGE_EXAMPLES.map((text) => ({ text, note: 'Variance bridge: price, volume, mix and FX' })))
      list.push(...config.EXAMPLES.map((text) => ({ text })))
      list.push(...config.DIRECT_EXAMPLES.map((text) => ({ text, note: 'Query language, answered without AI', code: true })))
      return list
    },

    allCompanyCodes() {
      return [...this.user.companies].sort()
    },

    // Empty has always meant "everything I can see", and the server still
    // reads it that way. Ticking every box means the same thing, so both
    // count as all: otherwise the box would untick itself on the last click.
    allSelected() {
      return !this.chosen.length || this.chosen.length === this.allCompanyCodes.length
    },

    companyGroups() {
      const groups = {}
      for (const code of [...this.user.companies].sort()) (groups[code.slice(2, 4)] ||= []).push(code)
      return Object.entries(groups).map(([country, codes]) => ({ country, name: COUNTRIES[country] || country, codes }))
    },

    scopeLabel() {
      if (this.allSelected) return 'All my companies'
      const whole = this.companyGroups.filter((group) => group.codes.every((code) => this.chosen.includes(code)))
      const covered = whole.flatMap((group) => group.codes)
      if (whole.length && covered.length === this.chosen.length) return `Only ${whole.map((group) => group.name).join(' and ')}`
      return this.chosen.length === 1 ? `Only ${this.chosen[0]}` : `Only ${this.chosen.length} companies`
    },

    historyGroups() {
      const today = new Date()
      const startOf = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      const todayStart = startOf(today)
      const yesterdayStart = todayStart - 86_400_000
      const groups = [
        { title: 'Today', items: [] },
        { title: 'Yesterday', items: [] },
        { title: 'Earlier', items: [] },
      ]
      for (const item of this.history) {
        const at = new Date(item.created_at).getTime()
        groups[at >= todayStart ? 0 : at >= yesterdayStart ? 1 : 2].items.push(item)
      }
      return groups.filter((group) => group.items.length)
    },
  },

  watch: {
    // The explained message left the conversation (cleared, or another opened)
    explained(message) {
      if (!message) this.explainKey = ''
    },

    search() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.loadHistory(), 250)
    },

    provider(value) {
      try {
        localStorage.setItem(this.$root.config.PROVIDER_STORAGE_KEY, value)
      } catch (e) {
        // storage unavailable; the choice lasts for this visit only
      }
    },
  },

  mounted() {
    try {
      const saved = localStorage.getItem(this.$root.config.PROVIDER_STORAGE_KEY)
      if (saved && this.$root.config.PROVIDERS.some((option) => option.id === saved)) this.provider = saved
    } catch (e) {
      // storage unavailable; keep the default
    }
    this.$root.api.getProviders().then((response) => {
      if (!response.error) this.providerStatus = response.data
    })
    this.loadHistory()
  },

  beforeUnmount() {
    clearInterval(this.clockTimer)
    clearTimeout(this.searchTimer)
  },

  methods: {
    toggleExplain(key) {
      this.explainKey = this.explainKey === key ? '' : key
    },

    setMessageRef(key, el) {
      if (el) this.messageRefs[key] = el
      else delete this.messageRefs[key]
    },

    isQueryLanguage(text) {
      return /^\s*select\b/i.test(text)
    },

    clock(value) {
      return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    },

    when(value) {
      return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    },

    // Only what is worth noticing in the list: the rest were answered
    pastNote(item) {
      if (item.withheld) return 'answer hidden'
      if (item.status === 'REFORECAST_PROPOSED') return 're-forecast drafted'
      if (['SUCCESS'].includes(item.status)) return ''
      return 'not answered'
    },

    selectAll(on) {
      this.chosen = on ? [...this.allCompanyCodes] : []
    },

    toggleCountry(group, on) {
      const others = this.chosen.filter((code) => !group.codes.includes(code))
      this.chosen = on ? [...others, ...group.codes] : others
    },

    fitField() {
      const field = this.$refs.field
      if (!field) return
      field.style.height = 'auto'
      field.style.height = `${Math.min(field.scrollHeight, 200)}px`
      field.style.overflowY = field.scrollHeight > 200 ? 'auto' : 'hidden'
    },

    onKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault()
        this.send()
      }
    },

    focusField() {
      this.$nextTick(() => {
        const field = this.$refs.field
        if (!field) return
        this.fitField()
        field.focus()
        field.setSelectionRange(field.value.length, field.value.length)
      })
    },

    // A suggestion fills the field so it can be adjusted; it is never asked right away
    useExample(text) {
      this.draft = text
      this.focusField()
    },

    editQuestion(text) {
      this.draft = text
      this.focusField()
    },

    scrollTo(key) {
      this.$nextTick(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        this.messageRefs[key]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      })
    },

    newConversation() {
      this.explainKey = ''
      this.messages = []
      this.draft = ''
      this.focusField()
    },

    async loadHistory() {
      const response = await this.$root.callAuthenticatedEndpoint('listAskHistory', this.search.trim())
      this.historyError = response.error ? response.message : ''
      if (!response.error) this.history = response.data
    },

    async openPast(item) {
      const shown = this.messages.find((message) => message.askId === item.ask_id)
      if (shown) return this.scrollTo(shown.key)
      const response = await this.$root.callAuthenticatedEndpoint('getAskHistory', item.ask_id)
      if (response.error) {
        this.historyError = response.message
        return
      }
      const past = response.data
      this.historyOpen = false
      this.messages = [{
        key: `past-${past.ask_id}`,
        askId: past.ask_id,
        question: past.question,
        askedAt: past.created_at,
        fromHistory: true,
        withheld: past.withheld,
        result: past.response,
        pending: false,
      }]
      this.scrollTo(`past-${past.ask_id}`)
    },

    async send(text) {
      const question = (text ?? this.draft).trim()
      if (!question || this.pending) return
      if (!/^SELECT\b/i.test(question) && this.providerError) return
      const key = `ask-${Date.now()}`
      this.messages.push({ key, question, askedAt: new Date().toISOString(), pending: true, result: null })
      if (text === undefined) this.draft = ''
      this.$nextTick(() => this.fitField())
      this.scopeOpen = false
      this.startedAt = Date.now()
      this.now = Date.now()
      this.clockTimer = setInterval(() => { this.now = Date.now() }, 1000)
      this.scrollTo(key)

      const response = await this.$root.callAuthenticatedEndpoint('askQuestion', {
        query: question,
        provider: this.provider,
        companies: this.allSelected ? [] : this.chosen,
      })
      clearInterval(this.clockTimer)

      const message = this.messages.find((item) => item.key === key)
      if (!message) return // the conversation was cleared meanwhile; the answer is in history
      message.pending = false
      // A transport failure is shown as an answer too, so there is one place to look
      message.result = response.error
        ? { agent_response: { execution_status: 'REQUEST_ERROR', error_message: response.message, cited_data_rows: [] } }
        : response.data
      message.askId = response.data?.ask_id || null
      this.scrollTo(key)
      this.loadHistory()
    },
  },
}
</script>

<style scoped>
.chat {
  display: grid;
  grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

/* History */
.chat__history {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 6rem);
  overflow: auto;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding-bottom: 0.5rem;
}
.chat__history-head {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 0.75rem 0.5rem;
}
.chat__search {
  display: block;
  width: calc(100% - 1.5rem);
  margin: 0 0.75rem 0.25rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
  font-size: 0.875rem;
  color: var(--ink);
}
.chat__history-toggle {
  display: none;
  font: inherit;
  color: inherit;
}
.chat__day {
  padding: 0.625rem 0.75rem 0.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-soft);
}
.chat__past {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-left: 3px solid transparent;
}
.chat__past:hover:not(:disabled) {
  background: var(--paper);
}
.chat__past--on {
  background: var(--wash);
  border-left-color: var(--ink);
}
.chat__past-question {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.875rem;
  color: var(--ink);
}
.chat__past-meta {
  font-size: 0.75rem;
  color: var(--ink-soft);
}

/* Conversation */
.chat__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: calc(100vh - 7rem);
}
.chat__messages {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  flex: 1;
  padding-bottom: 1.5rem;
}
.chat__empty {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 2rem 0 0;
}
.chat__suggestions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.chat__suggestion {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  height: 100%;
  padding: 0.75rem 0.875rem;
  text-align: left;
  color: var(--ink);
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.chat__suggestion:hover {
  border-color: var(--line-strong);
  background: var(--wash);
}
.chat__suggestion-note {
  font-size: 0.8125rem;
  color: var(--accent);
}

.chat__turn {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-margin-top: 1rem;
}
.chat__question-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}
.chat__question {
  max-width: min(42rem, 85%);
  padding: 0.625rem 0.875rem;
  border-radius: 12px 12px 4px 12px;
  background: var(--accent-wash);
  border: 1px solid var(--accent-line);
  color: var(--ink);
  white-space: pre-wrap;
}
.chat__when {
  font-size: 0.75rem;
  color: var(--ink-soft);
}
/* The answer whose explanation is open */
.chat__turn--explained :deep(.answer) {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-wash);
}
.chat__working {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  border: 1px dashed var(--line-strong);
  border-radius: 10px;
  color: var(--ink-mid);
}
.chat__withheld {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 1rem;
  border: 1px solid var(--warning-line);
  background: var(--warning-wash);
  border-radius: 10px;
}
.chat__after {
  display: flex;
  gap: 1rem;
}
.chat__link {
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
.chat__link:hover:not(:disabled) {
  color: var(--accent);
  text-decoration: underline;
}

/* Composer */
.chat__composer {
  position: sticky;
  z-index: 20;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: var(--card);
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  box-shadow: 0 -8px 16px var(--paper);
}
.chat__input {
  width: 100%;
  resize: none;
  overflow-y: hidden;
  border: 0;
  background: transparent;
  padding: 0.25rem 0.375rem;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--ink);
}
.chat__input::placeholder {
  color: var(--muted);
}
/* The composer shows focus for the whole box (focus-within below) */
.chat__input:focus,
.chat__input:focus-visible {
  outline: none;
  box-shadow: none;
  border-color: transparent;
}
.chat__composer:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-wash), 0 -8px 16px var(--paper);
}
.chat__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}
.chat__hint {
  font-size: 0.75rem;
  color: var(--ink-soft);
}
.chat__provider-field {
  display: flex;
  flex: 1 1 20rem;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  min-width: 0;
}
.chat__provider-error {
  flex: 1 1 18rem;
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--signal);
  overflow-wrap: anywhere;
}
.chat__provider {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
.chat__provider select {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--paper);
  padding: 0.125rem 1.5rem 0.125rem 0.375rem;
  font-size: 0.8125rem;
  color: var(--ink);
}
.chat__provider select[aria-invalid='true'] { border-color: var(--signal); }
.chat__provider select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.chat__scope {
  position: relative;
}
.chat__scope summary {
  cursor: pointer;
  list-style: none;
  padding: 0.25rem 0.625rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.8125rem;
  color: var(--ink-mid);
  background: var(--paper);
}
.chat__scope summary::-webkit-details-marker {
  display: none;
}
.chat__scope-menu {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 0;
  z-index: 10;
  width: 20rem;
  max-height: 22rem;
  overflow: auto;
  padding: 0.75rem;
  background: var(--card);
  border: 1px solid var(--line-strong);
  border-radius: 10px;
}
.chat__scope-all {
  display: flex;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--ink);
}
.chat__scope-group {
  margin-top: 0.625rem;
}
.chat__scope-country {
  display: flex;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-mid);
}
.chat__scope-option {
  display: inline-flex;
  gap: 0.375rem;
  margin: 0.25rem 0.75rem 0 0;
  font-size: 0.875rem;
  color: var(--ink);
}

@media (max-width: 900px) {
  .chat {
    grid-template-columns: 1fr;
  }
  .chat__history {
    position: static;
    max-height: none;
  }
  .chat__history-toggle {
    display: inline;
  }
  .chat__history-title {
    display: none;
  }
  .chat__history:not(.chat__history--open) .chat__history-body {
    display: none;
  }
  .chat__history-body {
    max-height: 18rem;
    overflow: auto;
  }
  .chat__hint {
    display: none;
  }
}
</style>
