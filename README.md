# FP&A Re-Forecast Copilot — UI

**Video:** _not recorded yet — add the shared 10–15 minute demo link here and in the API README._

Vue 3 + Vite + [frappe-ui](https://ui.frappe.io) frontend for the FP&A backend.
The API and UI are separate repositories. Clone them into sibling `api/` and
`ui/` directories. Needs Node.js 20.19+ or 22.12+, npm and the API's Docker stack.

```bash
cd ../api
cp .env.example .env
docker compose --env-file .env -f docker/docker-compose.yml up --build
# In a second terminal, from ui/:
npm ci
npm run dev      # http://localhost:8080
npm run build
```

Wait for the API's migrations and sample-data loading to finish. FastAPI runs
on `localhost:8000`; Vite proxies `/api` to it. There is no mock layer:
what a request returns depends on whose bearer token sent it, so mocked data
would prove nothing about scope.

## Signing in

Sign in with email and password. All seeded demo users use **`Fpa!12345`**:

| Email | Role |
|---|---|
| `test@analyst.com` | Analyst, scoped to Poland |
| `test@planner.com` | Planner, drafts reforecast requests |
| `test@controller.com` | Controller, reviews and approves |
| `test@cfo.com` | CFO, final approvals and plan locking |
| `test@superadmin.com` | Account and access administration |

**Demo accounts** also accepts seeded bearer tokens such as `tok-analyst-pl`.
The session token is kept in this tab's `sessionStorage`, survives refresh and
is checked with `GET /api/v1/me` before business screens mount. Logout clears
it and revokes an issued session on the server. When storage is blocked, it
remains in memory. A signup waits for a superadmin to grant roles and companies;
the superadmin sees account administration rather than business data.

## Using the interface

- **Ask:** choose companies within your allowed scope and a provider, then ask
  "Why did Poland miss its services revenue plan in Q2 2026? Break it down by practice."
  **Show explanation** exposes DSL, SQL, citations and the producing team member.
  The bridge labels each effect and residual; click a leg for source rows and
  the ledger vintage. **Collapse** hides that source table. **Show** / **Hide**
  in a row reveals its calculation, available operands and result. Recorded
  vintage changes use a comparison table. Utilisation explanations distinguish
  percentage points from relative percent.
- **Provider selection:** Claude subscription, Codex subscription, Claude API
  key and Gemini API key remain visible. API-key providers require the matching
  `ANTHROPIC_API_KEY` or `GOOGLE_API_KEY` in the API environment; missing keys
  display an error. Subscription login and optional Codex model configuration
  are described in the [API README](../api/README.md). No credentials are entered
  in the browser. A query beginning with `SELECT` runs directly without a model.
- **Plans:** inspect plan lines and derivations, review sign-off and open the
  plan's reforecast requests. Draft a request in Ask and confirm it before
  controller review. Workflow progress updates while running; eligible humans
  approve, reject and lock through the governed API.

## Architecture and decisions

Read path: Vue → FastAPI → guarded Agno team → FinOpsExpr compiler → ClickHouse.
Write path: Vue → FastAPI → Temporal → Postgres drafts → human decisions →
ClickHouse publication and the Commitment Service. The API owns formula
evaluation, scope enforcement, approval rules, audit and disclosure records.
The UI displays returned calculations and does not invent missing operands.

State lives in the Vue root instead of a separate store, keeping the small
application's session and shared API handling in one place. Role guards explain
unavailable actions, while every action still passes through server permission
checks. Ask and Plans preserve their state when switching tabs. Calculations
expand inside their source table; this keeps the formula beside the row being checked.

## Project structure

```
src/
  classes/         # FpaApi.js (all HTTP), UserPermissions.js (token session)
  components/      # AskChat, AnswerPanel, RowCalculation, VintageChanges, BridgeReport, PlanVersions
  config/          # appConfig.js — app-wide constants, tokens, example questions
  mixins/          # PageTitle
  router/          # index.js — routes + auth guard
  utils/           # dsl.js — plain-language helpers for FinOpsExpr and result rows
  views/           # page-level components, one per route (Home, Login, NotFound)
  App.vue          # root component — holds global state
  main.js          # entry point
```

## Global state

No Pinia/Vuex. Global state lives in `App.vue` `data()` and is reached from any
component through `this.$root`:

| Property | Type | Purpose |
|---|---|---|
| `this.$root.api` | `FpaApi` | All HTTP calls |
| `this.$root.user` | `UserPermissions` | Session identity, roles and allowed companies |
| `this.$root.config` | Object | Constants from `config/appConfig.js` |

Shared actions are `App.vue` methods: `callAuthenticatedEndpoint()`,
`handleLogin()`, `logout()`, `setAppInterval()`.

## API calls

Every `FpaApi` method is async and never throws. It resolves to
`{ error: false, status, data }` or `{ error: true, status, message }`.

Call authenticated endpoints through the root, which ends the session on a 401
— the token itself was not accepted. A **403 does not sign anyone out**: it is
this person being refused this operation (an analyst reading a plan version, say),
which is an answer to show them.

```js
const response = await this.$root.callAuthenticatedEndpoint('getPlanVersion', code)
if (response.error) {
  this.errorMessage = response.message
  return
}
this.plan = response.data
```

To add an endpoint, add a method to `src/classes/FpaApi.js` that calls
`this.request(endpoint, method, { params, body })`.

## Environment

| Variable | Dev | Prod | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | `/api/` | `/api/` | Base path; `/api` is proxied to the FastAPI backend on `localhost:8000` |

## Polling

Use `this.$root.setAppInterval(fn, ms)` in `mounted()` and
`this.$root.clearAppInterval(id)` in `beforeUnmount()`. All app intervals are
cleared on logout.

## Conventions

- Options API, `v-bind:` / `v-on:` longhand, `name` matches the filename
- Views use the `PageTitle` mixin; set `meta.pageTitle` on the route
- Routes require login by default; set `meta.requiresAuth: false` for public pages
- Styling with frappe-ui components and Tailwind classes (no SCSS)

## Verification

```bash
node --test tests/*.test.js
npm run build
```

The tests compile/render the real Vue components and check calculations,
missing inputs, vintage tables, provider readiness and utilisation labels.
They do not replace browser checks against the running API. For the assignment
demo, exercise an English question, DSL/member trace, bridge drill-through,
live workflow progress and human decisions in one browser pass. Show worker
restart both during recompute and while parked on approval, the July-close
answer and a refused attempt to widen scope. API test and recovery commands
are documented in the [API README](../api/README.md).

## Unfinished and simplified

- Creating an original plan remains a CLI/API action; Plans has no creation form.
- An explanation can only reproduce a result when the API returns its operands.
  Missing operands are disclosed rather than guessed.
- Browser automation for the full multi-user approval/restart flow is not included.
- Quarterly headcount closing-period handling, missing bridge FX errors and
  persistent compensation failure recovery remain API issues.
- Scenario projections use the seeded branch numbers rather than re-deriving
  them from overrides; consolidation and the other optional assignment features
  are unfinished. See the API README for backend limitations and submission checks.
- The required demo video is still pending.

## With two more weeks

1. Add original-plan creation and a guided multi-user sign-off walkthrough.
2. Automate browser acceptance checks for scope, row calculations and workflow recovery.
3. Improve keyboard and screen-reader coverage for tables and bridge drill-through.
4. Add consolidation and cross-vintage analysis when the backend acceptance checks pass.
