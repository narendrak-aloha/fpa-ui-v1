# fpa-project-ui

Vue 3 + Vite + [frappe-ui](https://ui.frappe.io) frontend for the FP&A backend.
Structure and state management follow the same pattern as `intandem_fe`.

```bash
npm install
npm run dev      # http://localhost:8080
npm run build
```

The FastAPI backend must be running on `localhost:8000` (`make docker-local-run`
in the fpa-project repo); Vite proxies `/api` to it. There is no mock layer:
what a request returns depends on whose bearer token sent it, so mocked data
would prove nothing about scope.

## Signing in

There is no login exchange. The human pastes a bearer token, and `GET /v1/me`
says who that is and which companies they can see. The token is held in memory
for the tab only — never in localStorage or sessionStorage — so a refresh asks
for it again and nothing is left behind on a shared machine.

Local demonstration identities are listed on the sign-in screen:
`tok-analyst-pl` (reads Poland), `tok-planner`, `tok-controller`, `tok-cfo`.

## Project structure

```
src/
  classes/         # FpaApi.js (all HTTP), UserPermissions.js (token session)
  components/      # AppHeader, AskQuestion, AnswerPanel, BridgeReport, BridgeNode, PlanWorkbench
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
| `this.$root.user` | `UserPermissions` | Who the token resolved to; in memory only |
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
