import test from 'node:test'
import assert from 'node:assert/strict'
import { answerRowCalculations } from '../src/utils/rowCalculations.js'

test('bridge summary explains the sum with real returned effects', () => {
  const row = { gap: -40, price: -240, volume: 200, mix: 0, fx: 0, rate: 0, efficiency: 0, residual: 0, currency: 'USD' }
  const [calculation] = answerRowCalculations(row)
  assert.equal(calculation.result, -40)
  assert.match(calculation.substitution, /\(-240\) \+ \(200\)/)
})
test('raw comparison converts each amount before subtracting', () => {
  const row = { plan_amount: '1000', actual_amount: '960', plan_fx: '0.25', actual_fx: '0.24' }
  const result = answerRowCalculations(row)
  assert.deepEqual(result.map(item => item.result), ['250.00', '230.40', '-19.60'])
})
test('aliases are bound to explicit DSL metrics and missing inputs disclosed', () => {
  const [item] = answerRowCalculations({ used: 0.75 }, 'SELECT utilisation AS used BY practice FOR PERIOD 2026-Q2')
  assert.match(item.formula, /51050/)
  assert.match(item.notes.join(' '), /cannot be independently reproduced/)
})
test('unknown columns and window functions get no invented formulas', () => {
  assert.deepEqual(answerRowCalculations({ unknown: 123 }), [])
  assert.deepEqual(answerRowCalculations({ yoy_utilisation: 0.5 }, 'SELECT YOY(utilisation) BY practice'), [])
})
test('null ratio results remain null', () => {
  const [item] = answerRowCalculations({ utilisation: null }, 'SELECT utilisation BY practice')
  assert.equal(item.result, null)
})
