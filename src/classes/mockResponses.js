// Sample data returned by FpaApi when VITE_USE_MOCK_API=true.
// Keys are "<METHOD> <endpoint>" and must match the endpoints used in FpaApi.

let plans = [
  { name: 'PLAN-0001', plan_name: 'Q3 Forecast', owner_team: 'Finance', status: 'Approved' },
  { name: 'PLAN-0002', plan_name: 'Marketing Budget', owner_team: 'Marketing', status: 'In Review' },
  { name: 'PLAN-0003', plan_name: 'Headcount Plan', owner_team: 'HR', status: 'Draft' },
]

const handlers = {
  'GET method/fpa.api.get_dashboard_stats': () => ({
    message: [
      { label: 'Revenue', value: 1240000, format: 'currency', change: '+8.2%', trend: 'up' },
      { label: 'Expenses', value: 782000, format: 'currency', change: '+3.1%', trend: 'warn' },
      { label: 'Net Margin', value: 0.37, format: 'percent', change: '+2.4%', trend: 'up' },
      { label: 'Budget Variance', value: -0.046, format: 'percent', change: 'Over', trend: 'down' },
    ],
  }),

  'GET method/fpa.api.get_lookup_values': (_body, params) => ({
    message: {
      owner_team: ['Finance', 'Marketing', 'HR', 'Operations'],
    }[params?.get('lookup_type')] || [],
  }),

  'GET resource/FPA Plan': () => ({ data: plans }),

  'POST resource/FPA Plan': (body) => {
    const plan = {
      name: `PLAN-${String(plans.length + 1).padStart(4, '0')}`,
      status: 'Draft',
      ...body,
    }
    plans = [plan, ...plans]
    return { data: plan }
  },
}

export function getMockResponse(method, endpoint, body) {
  const [path, query] = endpoint.split('?')
  const handler = handlers[`${method} ${decodeURIComponent(path)}`]
  if (!handler) {
    return { status: 404, json: { message: `No mock for ${method} ${path}` } }
  }
  return { status: 200, json: handler(body, new URLSearchParams(query)) }
}
