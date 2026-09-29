const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
})

// format: "currency" | "percent" | anything else returns the value as-is
export function formatValue(value, format) {
  if (typeof value !== 'number') return value
  if (format === 'currency') return currencyFormatter.format(value)
  if (format === 'percent') return percentFormatter.format(value)
  return value.toLocaleString('en-US')
}
