// Explain only formulas established by the query contract. Missing operands
// stay missing; aggregate results cannot be reverse engineered into inputs.
const METRICS = {
  services_revenue: 'Sum of local-currency amounts for services accounts 41000, 41010, 41020, 41400',
  delivery_cost: 'Sum of local-currency amounts for delivery accounts 51000, 51050, 51100, 51300, 51500',
  subcontractor_cost: 'Sum of local-currency amounts for account 51100',
  bookings: 'Sum of local-currency amounts for accounts 41000, 41010, 41020, 41400',
  gross_margin: 'Services revenue − Delivery cost',
  utilisation: 'Total quantity for accounts 41000, 41010, 41020 ÷ Total quantity for accounts 51000, 51050, 51400',
  realisation: 'Total amount for accounts 41000, 41010, 41020 ÷ Total quantity for those same accounts',
  gross_margin_pct: '(Services revenue − Delivery cost) ÷ Services revenue',
  headcount: 'Count of distinct non-empty employee identifiers in this group',
}
const has = (row, keys) => keys.every(key => row[key] != null && row[key] !== '' && Number.isFinite(Number(row[key])))
const label = key => key.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())

export function answerRowCalculations(row, dsl = '') {
  const items = []
  const legs = ['price', 'volume', 'mix', 'fx', 'rate', 'efficiency']
  if (has(row, ['gap', ...legs])) {
    items.push({ label: 'Total change', formula: 'Price + Volume + Mix + Exchange rates + Cost rate + Efficiency + Rounding residual',
      inputs: Object.fromEntries([...legs, 'residual'].map(key => [key === 'fx' ? 'Exchange rates' : label(key), row[key] ?? 'Not returned'])),
      substitution: row.residual != null ? [...legs, 'residual'].map(key => `(${row[key]})`).join(' + ') : null,
      result: row.gap, unit: row.currency || 'USD',
      notes: ['These are the returned effects for this group. Open “Show the variance bridge”, select this group and an effect, then use “Show” in the Calculation column on a source row to see its quantities, prices and FX rates.'] })
  }
  for (const end of ['plan', 'actual']) {
    if (!has(row, [`${end}_amount`, `${end}_fx`])) continue
    const amount = row[`${end}_amount`], fx = row[`${end}_fx`]
    const result = Number(amount) * Number(fx)
    items.push({ label: `${label(end)} amount in USD`,
      formula: `${label(end)} amount (local currency) × ${label(end)} FX rate`,
      inputs: { [`${label(end)} amount (local currency)`]: amount, [`${label(end)} FX rate (USD per local unit)`]: fx },
      substitution: `${amount} × ${fx}`, result: result.toFixed(2), unit: 'USD',
      notes: ['Calculated from the returned inputs. Stored local amounts can include source rounding.'] })
  }
  if (has(row, ['plan_amount', 'actual_amount', 'plan_fx', 'actual_fx'])) {
    const delta = Number(row.actual_amount) * Number(row.actual_fx) - Number(row.plan_amount) * Number(row.plan_fx)
    items.push({ label: 'Total revenue / cost change', formula: 'Actual amount × Actual FX rate − Plan amount × Plan FX rate',
      substitution: `${row.actual_amount} × ${row.actual_fx} − ${row.plan_amount} × ${row.plan_fx}`, result: delta.toFixed(2), unit: 'USD',
      notes: ['This is the total amount change. Individual bridge effects explain separate parts of it. Cost signs are reversed when calculating margin.'] })
  }
  // Bind aliases to the metric explicitly selected by the DSL, never to the
  // user's question or to an inferred meaning of a numeric column.
  const select = dsl.match(/^\s*SELECT\s+([\s\S]*?)(?:\s+BY\s|\s+WHERE\s|\s+FOR\s|\s+COMPARE\s|$)/i)?.[1] || ''
  for (const [metric, formula] of Object.entries(METRICS)) {
    const match = select.match(new RegExp(`(?:^|,)\\s*${metric}(?:\\s+AS\\s+([a-zA-Z_][a-zA-Z0-9_]*))?\\s*(?=,|$)`, 'i'))
    if (!match) continue
    const key = match[1] || metric
    if (!(key in row)) continue
    const isRatio = ['utilisation', 'realisation', 'gross_margin_pct'].includes(metric)
    items.push({ label: label(key), formula, result: row[key],
      inputs: { [label(key) + ' (returned value)']: row[key] },
      notes: [isRatio ? 'This ratio is recomputed from group totals, not averaged across rows. A zero denominator returns no value.' : 'This value is aggregated over the query filters and this row’s group.',
        'The query response does not return the underlying operands. This formula explains the definition; the result cannot be independently reproduced from this row alone.',
        ...(isRatio && metric !== 'realisation' ? ['The returned ratio is a fraction: 0.75 means 75%.'] : [])] })
  }
  return items
}
