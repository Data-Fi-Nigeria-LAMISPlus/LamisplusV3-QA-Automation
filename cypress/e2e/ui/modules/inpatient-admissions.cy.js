import { login } from '../../../support/modules/login'
import {
  ROUTES,
  clickRowAction,
  expectListShell,
  openFirstRowMenu,
  openPage,
  switchTab,
} from '../../../support/modules/app-nav'
import { createBed, scheduleAdmission } from '../../../support/modules/inpatient'

// Admissions to inpatient services: the queues, and admitting a scheduled
// patient for real.
//
// HEADS UP - the admission test writes state and consumes a bed. QA currently has
// a single bed ("BED1 - OPD"), so once it is occupied the Bed Assigned* selector
// has nothing left to offer and this test will fail until the patient is
// discharged or another bed is created. Options if that becomes a nuisance:
// add a discharge step to hand the bed back, or create a bed as part of setup.
//
// It also needs at least one patient on the Scheduled For Admission queue -
// scheduled via Emergency Admission on a patient row, which
// emergency-admission.cy.js exercises without submitting.

// Selects on this form store uuids, so a value is asserted as "something was
// chosen" rather than against the visible text.
const chooseFirstReal = (selector, label) => {
  cy.get(selector, { timeout: 20000 }).should(($select) => {
    const real = [...$select[0].options].filter((option) => option.value)
    expect(real.length, `${label} has options to choose`).to.be.greaterThan(0)
  })

  cy.get(selector).then(($select) => {
    const first = [...$select[0].options].find((option) => option.value)
    cy.log(`${label} -> ${first.text}`)
    cy.wrap($select).select(first.value, { force: true })
  })
  cy.wait(600)
}

describe('Inpatient admissions', () => {
  // NOTE: this suite needs at least one patient on the Scheduled For Admission
  // queue, and cannot currently create one itself.
  //
  // scheduleAdmission() in support/modules/inpatient.js implements the intended
  // setup (register -> check in -> Emergency Admission -> Save) but the API
  // rejects it with 404 "Could not create visit for scheduled admission" and
  // visitUuid: null in the payload, even for a patient who has just been checked
  // in. Until that is resolved the hook is left out rather than failing the whole
  // suite in a `before all`.
  beforeEach(() => {
    cy.session('ipc-admissions', () => {
      login()
    })
    openPage(ROUTES.admissions, /Admissions to In-Patient Services/i)
  })

  it('should render the admissions list with its expected columns', () => {
    expectListShell()

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Hospital No.', 'Patient Name', 'Sex', 'Age', 'Date Scheduled', 'Scheduled By', 'Actions']
        .forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should show the scheduled and admitted counters', () => {
    cy.contains(/Scheduled Admissions/i).should('exist')
    cy.contains(/Admitted Patients/i).should('exist')
  })

  it('should offer both queues', () => {
    cy.contains('button', 'Scheduled For Admission').should('exist')
    cy.contains('button', 'Admitted Patients').should('exist')
  })

  it('should switch to Admitted Patients and back', () => {
    switchTab('Admitted Patients')
    cy.get('body').should('not.contain', 'Page not found')

    switchTab('Scheduled For Admission')
    cy.get('table').should('exist')
  })

  it('should offer Admit Patient on a scheduled row', () => {
    openFirstRowMenu()

    cy.get('body > div[class*="-menu"], [data-cy="action-menu"]')
      .contains('button', 'Admit Patient')
      .should('exist')
  })

  it('should open the admission form with every required field', () => {
    openFirstRowMenu()
    clickRowAction('Admit Patient')

    cy.url({ timeout: 30000 }).should('include', '/ipc/admissions/admit')
    cy.contains('Record Admission Details', { timeout: 30000 }).should('exist')

    cy.get('[id="select-admission-type*"]').should('exist')
    cy.get('[id="select-admitting-clinician*"]').should('exist')
    cy.get('[id="select-reason-for-admission*"]').should('exist')
    cy.get('[id="select-bed-assigned*"]').should('exist')
    cy.contains('button', 'Save').should('exist')
    cy.contains('button', 'Cancel').should('exist')
  })

  it('should offer the documented admission types', () => {
    openFirstRowMenu()
    clickRowAction('Admit Patient')

    cy.get('[id="select-admission-type*"]', { timeout: 20000 }).then(($select) => {
      const types = [...$select[0].options].map((option) => option.text.trim())
      expect(types).to.include.members(['Direct', 'Planned/Elective', 'Observation', 'Day Case'])
    })
  })

  it('should admit a scheduled patient into an available bed', () => {
    // Make a bed first. Admitting occupies one permanently and QA starts with a
    // single bed, so without this the test passes once and then fails on every
    // later run with "Bed Assigned has options to choose: expected 0 to be above
    // 0" - which is exactly what happened before this step existed.
    createBed()

    openPage(ROUTES.admissions, /Admissions to In-Patient Services/i)

    // Capture who is being admitted so the Admitted queue can be checked after.
    cy.get('tbody tr', { timeout: 45000 }).should('have.length.greaterThan', 0)
    cy.get('tbody tr').first().find('td').eq(1).invoke('text').then((raw) => {
      const patient = (raw || '').replace(/\s+/g, ' ').trim()

      openFirstRowMenu()
      clickRowAction('Admit Patient')
      cy.contains('Record Admission Details', { timeout: 30000 }).should('exist')

      chooseFirstReal('[id="select-admission-type*"]', 'Admission Type')
      chooseFirstReal('[id="select-admitting-clinician*"]', 'Admitting Clinician')
      chooseFirstReal('[id="select-reason-for-admission*"]', 'Reason for Admission')
      chooseFirstReal('[id="select-bed-assigned*"]', 'Bed Assigned')
      chooseFirstReal('#select-consent-for-admission', 'Consent')

      // Assert the admission request, so a rejection reports the offending field
      // rather than the test only noticing a missing row later.
      cy.intercept('POST', '**').as('admitPatient')
      cy.contains('button', 'Save').click({ force: true })

      cy.wait('@admitPatient', { timeout: 30000 }).then(({ request, response }) => {
        const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
        const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
        expect(
          response?.statusCode,
          `admission rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`
        ).to.be.oneOf([200, 201])
      })

      // And that the patient really moved onto the Admitted queue.
      openPage(ROUTES.admissions, /Admissions to In-Patient Services/i)
      switchTab('Admitted Patients')
      cy.get('tbody', { timeout: 30000 }).invoke('text').should('include', patient.split(' ')[0])
    })
  })

  it('should report no matches for a patient that cannot exist', () => {
    cy.get('input[placeholder="Search..."]')
      .clear({ force: true })
      .type('ZZZ-NO-SUCH-ADMISSION', { force: true, delay: 20 })
    cy.wait(3000)

    // This list words its empty state as "No scheduled admissions found" rather
    // than the generic "No data available" the patient register uses.
    cy.get('tbody').invoke('text').should('match', /no .*(found|available|records?|results?)/i)
  })
})
