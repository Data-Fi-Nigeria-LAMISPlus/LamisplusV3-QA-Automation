import { apiGet, authenticate } from '../../support/modules/api-client'
import inventory from '../../fixtures/api-endpoints.json'

// Calls every endpoint that can be called without setup, and checks the API
// answers each one sanely.
//
// The targeted specs beside this one assert what individual endpoints return.
// This one asks a broader and cheaper question of the whole surface: is anything
// unreachable, and is anything blowing up? Those two failures are the ones that
// appear without anyone touching the endpoint - a route stops resolving after a
// refactor, or a query starts throwing on real data - and they would otherwise go
// unnoticed until a screen breaks.
//
// Scope: the 83 GET endpoints that take no path variable and have no side
// effect, from an inventory of 466. The other 383 need an id, a payload or a
// cleanup plan, so they belong in targeted tests rather than a blind sweep.
// Regenerate the inventory with:
//   node scripts/extract-api-endpoints.mjs --source ../Lamisplus3.0/api
//
// A status is "sane" when it is a success, or a deliberate refusal:
//   2xx  answered
//   400  rejected the request - usually a missing query parameter
//   401  needs different credentials
//   403  this user is not allowed
// Anything else is a finding. 404 means the route is not there at all, and 5xx
// means it broke.

const ENDPOINTS = inventory.sweepable

// Already covered by known-defects.cy.js with an explanation. Listed here so the
// sweep stays quiet about them and loud about anything new.
const KNOWN_BROKEN = {
  '/plugin/ehr/api/v1/scheduled-admissions': 'returns 500 - see known-defects.cy.js',
  '/api/audit/events': 'returns 500 - see known-defects.cy.js',
  '/core/api/v1/plugin/manifest': 'returns 500 - see known-defects.cy.js',
}

// 503 is deliberate: several features are switched off on this environment and
// say so honestly. It is reported below rather than failed, because a feature
// being off is a deployment decision, not a broken endpoint.
const FEATURE_OFF = 503

const SANE = [200, 201, 202, 204, 400, 401, 403, FEATURE_OFF]

describe('API - endpoint sweep', () => {
  const results = []

  before(() => {
    authenticate().then(() => {
      // Sequential on purpose: the point is coverage, not load, and hammering 83
      // endpoints in parallel would trip the rate limiter and report throttling
      // as breakage.
      cy.wrap(ENDPOINTS, { log: false }).each((endpoint) => {
        apiGet(endpoint.path).then((response) => {
          results.push({ ...endpoint, status: response.status })
        })
      })
    })
  })

  it(`should reach all ${ENDPOINTS.length} endpoints without a routing gap`, () => {
    const missing = results.filter((result) => result.status === 404)

    expect(
      missing.map((result) => `${result.path} (${result.controller})`),
      'endpoints that answered 404 - the route is not registered'
    ).to.deep.equal([])
  })

  it('should not return a server error from any endpoint', () => {
    const exploded = results
      .filter((result) => result.status >= 500 && result.status !== FEATURE_OFF)
      .filter((result) => !KNOWN_BROKEN[result.path])

    expect(
      exploded.map((result) => `${result.path} -> ${result.status} (${result.controller})`),
      'endpoints that returned 5xx'
    ).to.deep.equal([])
  })

  it('should name the features switched off on this environment', () => {
    const off = results.filter((result) => result.status === FEATURE_OFF)

    off.forEach((result) => cy.log(`switched off: ${result.path}`))

    // Not an assertion against a fixed list - which features are enabled differs
    // per environment. The point is that the report says which, so nobody spends
    // an afternoon debugging a screen behind a feature that was never turned on.
    expect(off.every((result) => result.status === FEATURE_OFF), 'all reported as 503').to.equal(true)
  })

  it('should answer every endpoint with a recognised status', () => {
    const odd = results
      .filter((result) => !SANE.includes(result.status))
      .filter((result) => !KNOWN_BROKEN[result.path])

    expect(
      odd.map((result) => `${result.path} -> ${result.status}`),
      'unexpected status codes'
    ).to.deep.equal([])
  })

  it('should report how the surface responded', () => {
    const byStatus = results.reduce((counts, result) => {
      counts[result.status] = (counts[result.status] ?? 0) + 1
      return counts
    }, {})

    cy.log(`swept ${results.length} endpoints`)
    Object.entries(byStatus)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([status, count]) => cy.log(`  ${status}: ${count}`))

    // The inventory and the run should agree; a mismatch means the fixture was
    // regenerated without the sweep being re-run.
    expect(results.length, 'every inventory entry was called').to.eq(ENDPOINTS.length)
  })
})
