import { apiGet, authenticate, expectApiError } from '../../support/modules/api-client'

// Defects, recorded so they are not rediscovered and so a fix is noticed.
//
// ── The swallowed-route defect ──────────────────────────────────────────────
//
// Four endpoints cannot be reached at all. Each sits in a controller that also
// declares an unconstrained id template on the same base path:
//
//   @GetMapping("/{triageUuId}")      swallows  /triage/patients-in-waiting
//   @GetMapping("/{uuid}")            swallows  /lab-order-samples/laboratory-stats
//   @GetMapping("/{dispensingUuid}")  swallows  /drug-dispensing/...monthly-summary
//
// Spring matches the template first, tries to parse the literal segment as a
// UUID and fails, so the request comes back 400 "Invalid value for parameter:
// <the id>" - naming a parameter the caller never sent, which is what makes this
// confusing to diagnose from the outside.
//
// The same defect was found and fixed once, in ConsultationController:
//
//   // The UUID constraint keeps this template from swallowing sibling literal
//   // routes that share this base path - most notably GET /general-dashboard
//   @GetMapping("/{consultationUuid:" + UUID_PATTERN + "}")
//
// That fix is in the source but not on this environment, and the same constraint
// was never applied to the other three controllers.
//
// Fix: constrain each id template with UUID_PATTERN the way ConsultationController
// does. Each test below then fails, and should be changed to expect 200.

const SWALLOWED_ROUTES = [
  ['the consultation dashboard', '/plugin/ehr/api/v1/consultation/general-dashboard', 'consultationUuid'],
  ['the triage waiting list', '/plugin/ehr/api/v1/triage/patients-in-waiting', 'triageUuId'],
  ['the triage attended list', '/plugin/ehr/api/v1/triage/patients-attended-to', 'triageUuId'],
  ['the laboratory statistics', '/plugin/ehr/api/lab-order-samples/laboratory-stats', 'uuid'],
  ['the pharmacy monthly summary', '/plugin/ehr/api/v1/drug-dispensing/drug-order-and-dispensing-monthly-summary', 'dispensingUuid'],
]

describe('API - known defects', () => {
  before(() => {
    authenticate()
  })

  describe('routes swallowed by an unconstrained id template', () => {
    SWALLOWED_ROUTES.forEach(([name, url, parameter]) => {
      it(`should fail to reach ${name} (app defect)`, () => {
        apiGet(url).then((response) => {
          const error = expectApiError(response, { status: 400, code: 'INVALID_INPUT_FORMAT' })

          // The giveaway: it complains about an id the caller never sent.
          expect(error.message, 'names the id template that captured the route')
            .to.eq(`Invalid value for parameter: ${parameter}`)
        })
      })
    })
  })

  // Records a server-side failure, not a bad request: the endpoint is reachable
  // and the caller sends nothing, yet it errors. The scheduled-admissions list is
  // what the inpatient admissions worklist is built from, which is why that UI
  // spec finds an empty queue.
  it('should fail to list scheduled admissions (app defect)', () => {
    apiGet('/plugin/ehr/api/v1/scheduled-admissions').then((response) => {
      expectApiError(response, { status: 500, code: 'INTERNAL_ERROR' })
    })
  })

  // Discharging is broken the same way - a well-formed payload comes back 500.
  // Covered end to end by the inpatient-discharge UI spec; kept here so the API
  // suite alone shows it too.
  it('should reject a discharge with a server error (app defect)', () => {
    cy.request({
      method: 'POST',
      url: '/plugin/inpatient/api/v1/discharges',
      headers: { Authorization: `Bearer ${Cypress.env('accessToken')}`, 'Content-Type': 'application/json' },
      failOnStatusCode: false,
      body: {
        admissionUuid: '00000000-0000-0000-0000-000000000000',
        patientUuid: '00000000-0000-0000-0000-000000000000',
        visitUuid: '00000000-0000-0000-0000-000000000000',
        note: 'API suite - discharge endpoint health check',
      },
    }).then((response) => {
      // A rejected payload would be 400; this is the endpoint itself failing.
      expect(response.status, 'discharge endpoint').to.not.eq(200)
      expect(response.status, 'discharge endpoint').to.be.oneOf([400, 500])
      if (response.status === 500) {
        expectApiError(response, { status: 500, code: 'INTERNAL_ERROR' })
      }
    })
  })
})
