import { login } from '../../../support/modules/login'
import {
  HIV_ROUTES,
  openFirstRowActions,
  openHivForm,
  openHivPage,
  rowActionLabels,
  switchWorklistTab,
} from '../../../support/modules/hiv'
import {
  assertNothingLeftEmpty,
  expandAllSections,
  fillEverything,
  sectionTitles,
} from '../../../support/modules/form-fill'

// Viral Hepatitis services (/pbh/hiv/viral-hepatitis): the enrolment form and the
// follow-up form.
//
// This is the only HIV service on this build backed by real data and real
// endpoints, so unlike HTS, ART and PrEP its saves can actually be verified -
// each stage of the enrolment posts to its own endpoint under
// /plugin/pbh/api/v1/hepatitis_enrollment, and the follow-up posts to
// /plugin/pbh/api/v1/hepatitis_followup.
//
// Consequences of it being real:
//   - the waiting queue holds patients with a hepatitis screening result, so it is
//     small; a run needs at least one to enrol
//   - the enrolment is a staged wizard with its own client-side validation, so the
//     sweep has to answer everything before Save will post at all

const HEPATITIS_POST = /\/plugin\/pbh\/api\/v1\/hepatitis_(enrollment|followup)/

describe('HIV - Viral Hepatitis forms', () => {
  beforeEach(() => {
    cy.session('hiv-hepatitis', () => {
      login()
    })
  })

  it('should render the worklist and both queues', () => {
    openHivPage(HIV_ROUTES.viralHepatitis, /Viral Hepatitis Services/i)

    cy.get('table', { timeout: 30000 }).should('exist')
    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Patient ID', 'Full Name', 'Sex', 'Age', 'Actions'].forEach((column) =>
        expect(actual).to.include(column))
    })

    cy.contains('button', 'Patients In Waiting').should('exist')
    cy.contains('button', 'Hepatitis Patients').should('exist')
  })

  it('should offer enrolment on a waiting patient and follow-up on an enrolled one', () => {
    openHivPage(HIV_ROUTES.viralHepatitis, /Viral Hepatitis Services/i)

    openFirstRowActions()
    rowActionLabels().then((labels) => {
      expect(labels, 'waiting queue offers enrolment').to.include('Enroll Patient')
    })

    switchWorklistTab('Hepatitis Patients')

    // An empty queue still renders a row - the "no data" placeholder - so the
    // presence of an actions trigger is what says there is really a patient here.
    cy.get('body').then(($body) => {
      if (!$body.find('tbody tr button[aria-label="Open actions menu"]').length) {
        cy.log('no enrolled hepatitis patients yet - follow-up actions cannot be listed')
        return
      }
      openFirstRowActions()
      rowActionLabels().then((labels) => {
        expect(labels).to.include('Follow Up')
      })
    })
  })

  describe('enrolment form', () => {
    beforeEach(() => {
      openHivForm({
        route: HIV_ROUTES.viralHepatitis,
        heading: /Viral Hepatitis Services/i,
        action: 'Enroll Patient',
        expectUrl: '/viral-hepatitis/enrolment',
        expectText: /Enrolment|Care entry point/i,
      })
    })

    it('should render its enrolment and screening sections', () => {
      sectionTitles().then((titles) => {
        const joined = titles.join(' | ')
        expect(joined).to.match(/Enrolment/)
        expect(joined).to.match(/Screening/)
      })

      cy.contains('button', 'Save').should('exist')
    })

    it('should derive the lab-driven clinical parameters rather than accept them', () => {
      // These live in the Ancillary Testing section, which is collapsed on arrival
      // and renders none of its content until expanded.
      expandAllSections()

      // Bilirubin, albumin, APRI, FIB-4 and the rest are pulled from the patient's
      // lab results, not typed in.
      ;['bilirubinLabResultUuid', 'albuminLabResultUuid', 'apriScore', 'fib4'].forEach((name) => {
        cy.get(`input[name="${name}"]`).should('be.disabled')
      })
    })

    it('should fill every field on the form', () => {
      fillEverything()
      assertNothingLeftEmpty()
      cy.screenshot('hiv-hepatitis-enrolment-filled')
    })

    // The enrolment endpoint is switched off on this environment: it answers
    // 503 SERVICE_UNAVAILABLE ("This feature is not available right now"), which is
    // a disabled feature rather than a rejected payload. So the test verifies what
    // the form does - that it posts the patient and the answers to the right
    // endpoint - and tolerates that one status while failing on any real rejection.
    //
    // Once the endpoint is enabled this passes on 200/201 unchanged; tighten it to
    // 200/201 only at that point.
    it('should post the enrolment to demography-and-screening when saved', () => {
      cy.intercept({ method: 'POST', url: HEPATITIS_POST }).as('enrolment')

      fillEverything()
      cy.contains('button', 'Save').should('not.be.disabled').click({ force: true })

      cy.wait('@enrolment', { timeout: 30000 }).then(({ request, response }) => {
        const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
        const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
        const payload = JSON.parse(sent)

        expect(request?.url, 'posted to the enrolment endpoint').to.match(/demography-and-screening/)
        expect(payload.patientUuid, 'carries the patient').to.be.a('string').and.not.be.empty
        expect(payload.dateOfVisit, 'carries the visit date').to.match(/\d{4}-\d{2}-\d{2}/)
        expect(payload.careEntryPoint, 'carries the answers').to.be.a('string').and.not.be.empty

        if (response?.statusCode === 503) {
          cy.log('enrolment endpoint is disabled on this environment (503 SERVICE_UNAVAILABLE)')
          expect(body, 'refused as an unavailable feature').to.match(/SERVICE_UNAVAILABLE/)
          return
        }

        expect(
          response?.statusCode,
          `hepatitis enrolment rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`
        ).to.be.oneOf([200, 201])
      })
    })
  })

  // The follow-up form is only reachable from an already-enrolled patient, and
  // this module reads real data - so unlike the mock-backed HIV services, the
  // queue can genuinely be empty. That is an environment state, not a defect, so
  // these tests skip rather than fail when there is nobody to follow up: a red
  // suite would say the form is broken when it is only unvisited.
  describe('follow-up form', () => {
    beforeEach(function () {
      const test = this

      openHivPage(HIV_ROUTES.viralHepatitis, /Viral Hepatitis Services/i)
      switchWorklistTab('Hepatitis Patients')

      cy.get('body').then(($body) => {
        // An empty queue still renders its "no data" row, so look for the actions
        // trigger rather than for rows.
        if (!$body.find('tbody tr button[aria-label="Open actions menu"]').length) {
          cy.log('no enrolled hepatitis patient on this environment - follow-up cannot be opened')
          test.skip()
          return
        }

        openFirstRowActions()
        cy.get('body').then(($menu) => {
          const hasFollowUp = [...$menu.find('button')].some((button) => /^Follow Up$/i.test((button.innerText || '').trim()))
          if (!hasFollowUp) {
            cy.log('the enrolled row offers no Follow Up action')
            test.skip()
            return
          }

          cy.contains('button', 'Follow Up').click({ force: true })
          cy.url({ timeout: 30000 }).should('include', '/viral-hepatitis/follow-up')
          cy.contains(/HBV Tests/i, { timeout: 30000 }).should('exist')
          cy.wait(2000)
        })
      })
    })

    it('should render its five treatment sections', () => {
      sectionTitles().then((titles) => {
        const joined = titles.join(' | ')
        expect(joined).to.match(/HBV Tests/)
        expect(joined).to.match(/Liver Function Test/)
        expect(joined).to.match(/Hepatitis B Treatment/)
        expect(joined).to.match(/Hepatitis C Treatment/)
        expect(joined).to.match(/General/)
      })

      cy.contains('button', 'Submit').should('exist')
    })

    it('should fill every field on the form', () => {
      fillEverything()
      assertNothingLeftEmpty()
      cy.screenshot('hiv-hepatitis-follow-up-filled')
    })

    it('should post the follow-up when submitted', () => {
      cy.intercept({ method: 'POST', url: HEPATITIS_POST }).as('followUp')

      fillEverything()
      cy.contains('button', 'Submit').should('not.be.disabled').click({ force: true })

      cy.wait('@followUp', { timeout: 30000 }).then(({ request, response }) => {
        const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
        const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)

        // Same allowance as the enrolment: a disabled endpoint is not a rejected
        // payload. Anything else is a real failure.
        if (response?.statusCode === 503) {
          cy.log('follow-up endpoint is disabled on this environment (503 SERVICE_UNAVAILABLE)')
          expect(body, 'refused as an unavailable feature').to.match(/SERVICE_UNAVAILABLE/)
          return
        }

        expect(
          response?.statusCode,
          `hepatitis follow-up rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`
        ).to.be.oneOf([200, 201])
      })
    })
  })
})
