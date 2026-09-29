import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import * as Vue from 'vue'
import { renderToString } from '@vue/server-renderer'
import { parse, compileTemplate } from '@vue/compiler-sfc'
import { answerRowCalculations } from '../src/utils/rowCalculations.js'
import { formatCell, niceName, OUTCOME, compactCompanies } from '../src/utils/dsl.js'
import { companiesLabel, driverName, driverValue, monthsLabel } from '../src/utils/labels.js'

// Compile the real Vue templates and scripts without starting an API or
// invoking a model. Frappe controls and child bridge loading are stubbed.
async function loadComponent(name, scope = {}) {
  const filename = new URL(`../src/components/${name}.vue`, import.meta.url)
  const { descriptor } = parse(await fs.readFile(filename, 'utf8'))
  const script = descriptor.script.content.replace(/^import .*$/gm, '').replace('export default', 'return')
  const component = new Function(...Object.keys(scope), script)(...Object.values(scope))
  const compiled = compileTemplate({ source: descriptor.template.content, filename: filename.pathname,
    id: name, compilerOptions: { mode: 'function' } })
  assert.deepEqual(compiled.errors, [])
  component.render = new Function('Vue', compiled.code)(Vue)
  return component
}
const RowCalculation = await loadComponent('RowCalculation')
const VintageChanges = await loadComponent('VintageChanges', { niceName })
const Button = { template: '<button><slot /></button>' }
const BridgeReport = { template: '<div />' }
const AnswerPanel = await loadComponent('AnswerPanel', { RowCalculation, VintageChanges, Button, BridgeReport, answerRowCalculations,
  formatCell, niceName, OUTCOME, compactCompanies, companiesLabel, driverName, driverValue, monthsLabel })

const props = { query: 'utilisation', result: {
  columns: ['practice', 'utilisation'],
  row_calculations: [[{ label: 'Utilisation', formula: 'Service quantity ÷ Delivery quantity',
    inputs: { 'Service quantity': '75', 'Delivery quantity': '100' }, substitution: '75 ÷ 100', result: '0.75', notes: [] }]],
  agent_response: { execution_status: 'SUCCESS', generated_dsl: 'SELECT utilisation BY practice',
    cited_data_rows: [{ practice: 'Engineering', utilisation: 0.75 }] },
} }

test('the answer table stays folded until its row calculation is opened', async () => {
  const html = await renderToString(Vue.createSSRApp(AnswerPanel, props))
  assert.match(html, /Show/)
  assert.doesNotMatch(html, /75 ÷ 100/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /<thead><tr><th class="answer__toggle-column">Calculation<\/th>/)
  assert.match(html, /<tbody><!--\[--><!--\[--><tr><td class="answer__toggle-column">/)
})
test('expanded answer row renders exact operands and result', async () => {
  const open = { ...AnswerPanel, data() { return { ...AnswerPanel.data(), expandedRow: 0 } } }
  const html = await renderToString(Vue.createSSRApp(open, props))
  assert.match(html, /Service quantity/)
  assert.match(html, /75 ÷ 100/)
  assert.match(html, /colspan="3"/)
  assert.match(html, /aria-expanded="true"/)
  assert.doesNotMatch(html, /cannot be independently reproduced/)
})
test('missing calculation inputs have a visible explanation', async () => {
  const html = await renderToString(Vue.createSSRApp(RowCalculation, { calculations: [] }))
  assert.match(html, /No missing quantity, price, or exchange rate has been assumed/)
})
test('server calculations stay attached to the source row after sorting', () => {
  const low = { utilisation: 0.25 }, high = { utilisation: 0.75 }
  const context = { rows: [low, high], result: { row_calculations: [[{ label: 'Utilisation', result: 'low' }], [{ label: 'Utilisation', result: 'high' }]] }, dsl: 'SELECT utilisation' }
  assert.equal(AnswerPanel.methods.rowCalculations.call(context, high)[0].result, 'high')
})

const SourceBridge = await loadComponent('BridgeReport', { RowCalculation, Button, niceName,
  BridgeNode: { template: '<div />' }, ErrorMessage: { template: '<div />' }, LoadingIndicator: { template: '<div />' } })

test('bridge expanded row shows local inputs, USD result, and correct table span', async () => {
  const node = { path: ['Engineering'], plan_amount: 1000, actual_amount: 960, gap: -40,
    price: -240, volume: 200, mix: 0, fx: 0, rate: 0, efficiency: 0, residual: 0, tolerance: 1, ties: true }
  const row = { company_code: 'RTPL1', period_month: '2026-06-01', account_code: '41400', dim_signature_hash: 'a',
    path: ['Engineering'], plan_quantity: '10', actual_quantity: '12', plan_unit_price: '100', actual_unit_price: '80',
    plan_amount: '1000', actual_amount: '960', contribution: '-240', vintage: 2,
    calculation: { label: 'Price', formula: '(Actual unit price − Plan unit price) × Actual quantity × Plan FX rate',
      substitution: '(80 − 100) × 12 × 1', result: '-240.00', unit: 'USD', inputs: { 'Actual quantity': '12' } } }
  const open = { ...SourceBridge, watch: {}, data() { return { ...SourceBridge.data(),
    report: { root: node, rollup: ['practice'], report_id: 'test', ties: true }, selectedNode: node,
    rows: [row], selectedLeg: 'price', expandedRow: 'RTPL1|2026-06-01|41400|a' } } }
  const html = await renderToString(Vue.createSSRApp(open))
  assert.match(html, /\(80 − 100\) × 12 × 1/)
  assert.match(html, /-240.00 USD/)
  assert.match(html, /colspan="13"/)
  assert.match(html, /in local currency/)
  assert.match(html, /class="bridge__table-scroll/)
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /<thead><tr><th class="bridge__toggle-column">Calculation<\/th><th>Company/)
  assert.match(html, />Collapse<\/button>/)
  const collapsed = { ...open, data() { return { ...open.data(), sourceRowsExpanded: false } } }
  const collapsedHtml = await renderToString(Vue.createSSRApp(collapsed))
  assert.match(collapsedHtml, /<div(?=[^>]*class="bridge__source-content")(?=[^>]*style="display:none;")[^>]*>/)
  assert.doesNotMatch(collapsedHtml, />Collapse<\/button>/)
  assert.doesNotMatch(collapsedHtml, /Show more rows/)
})

test('recorded vintage drift renders readable comparisons instead of JSON', async () => {
  const result = { ...props.result, agent_response: { ...props.result.agent_response, drift_flags: [{
    drift: true, scope: ['RTPL1'],
    left: { vintage: 1, rows: 12, digest: 'internal-ledger-hash', totals: { services_revenue: '1000.25' } },
    right: { vintage: 2, rows: 13, totals: { services_revenue: '950.25' } },
    deltas: { services_revenue: '-50' },
  }] } }
  const html = await renderToString(Vue.createSSRApp(AnswerPanel, { ...props, result }))
  assert.match(html, /Recorded vintage changes/)
  assert.match(html, /Vintage 1/)
  assert.match(html, /Vintage 2/)
  assert.match(html, /1,000.25/)
  assert.match(html, /950.25/)
  assert.match(html, /-50/)
  assert.match(html, /12 → 13/)
  assert.doesNotMatch(html, /internal-ledger-hash|&quot;drift&quot;|<pre/)
})
test('missing vintage totals stay missing instead of becoming zero', async () => {
  const html = await renderToString(Vue.createSSRApp(VintageChanges, { flags: [{
    drift: true, left: { vintage: 1 }, right: { vintage: 2, totals: { services_revenue: '25' } },
  }] }))
  assert.match(html, /<td>—<\/td>/)
  assert.match(html, /<td>25<\/td>/)
})

const { default: appConfig } = await import('../src/config/appConfig.js')
const AskChat = await loadComponent('AskChat', { Button, AnswerPanel,
  AnswerExplanation: { template: '<div />' }, SidePanel: { template: '<div />' },
  ErrorMessage: { template: '<div />' }, LoadingIndicator: { template: '<div />' } })

test('API-key provider choices remain visible when keys are missing', async () => {
  const chat = { ...AskChat, data() { return { ...AskChat.data.call(this), provider: 'claude-api', draft: 'Show revenue',
    providerStatus: appConfig.PROVIDERS.map(option => ({ id: option.id, configured: false })) } } }
  const root = { data: () => ({ config: appConfig, user: { companies: ['RTPL1'], hasRole: () => false } }),
    render: () => Vue.h(chat) }
  const html = await renderToString(Vue.createSSRApp(root))
  assert.match(html, /Claude \(API key\)/)
  assert.match(html, /Gemini \(API key\)/)
  assert.match(html, /API key is missing/)
  assert.match(html, /ANTHROPIC_API_KEY/)
  assert.match(html, /role="alert"/)
  assert.match(html, /class="chat__provider-field">[\s\S]*?<select[\s\S]*?id="chat-provider-error"[\s\S]*?<\/p><\/div>/)
})
test('configured API keys and direct DSL allow submitting a query', () => {
  const context = { $root: { config: appConfig }, provider: 'gemini', draft: 'Show revenue',
    providerStatus: [{ id: 'gemini', configured: true }] }
  assert.equal(AskChat.computed.providerError.call(context), '')
  context.providerStatus[0].configured = false
  assert.match(AskChat.computed.providerError.call(context), /GOOGLE_API_KEY/)
  context.draft = 'SELECT services_revenue BY practice'
  assert.equal(AskChat.computed.providerError.call(context), '')
  assert.equal(AskChat.computed.canSend.call({ draft: 'Show revenue', pending: false, providerError: 'Key missing' }), false)
})

const LineDerivation = await loadComponent('LineDerivation', { companiesLabel, driverName, driverValue, monthsLabel })
test('utilisation derivation distinguishes percentage points from relative percent', async () => {
  const line = { quantity: 80, unit_price: 50, amount_functional: 4000, functional_currency: 'USD',
    driver_derivation_trace: { method: 'driver_elasticity', formula: 'quantity × price', result: { quantity: 80, unit_price: 50, amount: 4000 },
      inputs: { baseline: { quantity: 100, unit_price: 50 }, applied_factors: { quantity: 0.8 },
        drivers: { utilisation: { from: 0.75, to: 0.6, ratio: 0.8, shocked_directly: true } } } } }
  const html = await renderToString(Vue.createSSRApp(LineDerivation, { line }))
  assert.match(html, /Absolute change: 60% − 75% = <strong>−15 percentage points/)
  assert.match(html, /Relative change: \(60% − 75%\) ÷ 75% × 100 = <strong>−20%/)
  line.driver_derivation_trace.inputs.drivers.utilisation.from = 0
  const zeroHtml = await renderToString(Vue.createSSRApp(LineDerivation, { line }))
  assert.match(zeroHtml, /cannot be calculated from a zero starting value/)
})
