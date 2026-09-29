// App-wide constants. Loaded into this.$root.config by App.vue
const appConfig = {
  APP_TITLE: 'FPA Assignment',

  // true: routes need a token. The FastAPI backend refuses every request
  // without one either way, so turning this off only hides the token screen.
  AUTH_ENABLED: true,

  // How often the re-forecast progress query is polled while a run is going
  PROGRESS_POLL_INTERVAL: 2000,

  // Seeded demo people, offered under Demo accounts. Clicking one fills the
  // sign-in form; the person still presses Sign in. What each may do is
  // decided by the server, not here.
  DEMO_PASSWORD: 'Fpa!12345',
  DEMO_ACCOUNTS: [
    { email: 'test@superadmin.com', mark: 'SA', label: 'Superadmin', hint: 'Approves new accounts and grants roles and companies; no business role' },
    { email: 'test@planner.com', mark: 'PL', label: 'Planner', hint: 'Asks for re-forecasts, confirms them, reviews and submits the recomputed lines' },
    { email: 'test@controller.com', mark: 'CT', label: 'Controller', hint: 'Approves or rejects submitted plans' },
    { email: 'test@cfo.com', mark: 'CFO', label: 'CFO', hint: 'Locks approved plans; the system then publishes them' },
    { email: 'test@analyst.com', mark: 'AN', label: 'Poland analyst', hint: 'Asks questions about Poland only' },
  ],

  // Model providers, in the order they are offered
  PROVIDERS: [
    { id: 'claude-code', label: 'Claude (subscription)', title: 'Uses your Claude Code login, no API key needed' },
    { id: 'claude-api', label: 'Claude (API key)', title: 'Needs ANTHROPIC_API_KEY', apiKeyEnv: 'ANTHROPIC_API_KEY' },
    { id: 'gemini', label: 'Gemini (API key)', title: 'Needs GOOGLE_API_KEY', apiKeyEnv: 'GOOGLE_API_KEY' },
  ],

  // Questions offered as one-click examples
  EXAMPLES: [
    'What was services revenue by practice in Q2 2026?',
    'Show gross margin % by geo region for 2026-Q2',
    'Delivery cost by country for Q2 2026',
    'Compare base plan vs actual services revenue by company for 2026-Q2',
  ],

  // The variance bridge: a "why" question, which splits the gap into price,
  // volume, mix and FX rather than answering with one number.
  BRIDGE_EXAMPLES: [
    'Why did Poland miss its services revenue plan in Q2 2026? Break it down by practice.',
    'Why is delivery cost above plan for Q2 2026?',
  ],

  // Offered to planners: a question that drafts a re-forecast for sign-off.
  // Short and imperative on purpose: a descriptive sentence is read as a
  // question and comes back without a draft.
  REFORECAST_EXAMPLE: 'Drop Poland utilisation to 72% and re-run the second half',

  // Runs straight through the compiler, with no model involved
  DIRECT_EXAMPLES: ['SELECT services_revenue BY company FOR PERIOD 2026-Q2'],

  DEFAULT_PLAN_CODE: 'PV-2026-0001',

  // Remembered between visits; the token never is
  PROVIDER_STORAGE_KEY: 'fpa-provider',
}

export default appConfig
