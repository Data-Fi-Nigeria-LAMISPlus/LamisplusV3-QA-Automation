import { login } from '../../../support/modules/login'
import {
  addClinicalDiagnosis,
  addPresentingComplaint,
  fillPhysicalExamination,
} from '../../../support/modules/encounter-form'
import {
  ROUTES,
  actionMenuItems,
  dismissActionMenu,
  expectListShell,
  openFirstRowMenu,
  openPage,
  switchTab,
} from '../../../support/modules/app-nav'

// The consultation worklist and its stage counters. Filling and saving the
// encounter form is covered by opd-consultation/opd-consultation-fill-form.cy.js.

const EXPECTED_COLUMNS = [
  'Hospital Number',
  'Patient Name',
  'Sex',
  'Age',
  'Check-in Date',
  'Service Point',
]

const openEncounterForm = () => {
  openFirstRowMenu()
  cy.get('[data-cy="action-menu"]')
    .contains('button', 'Fill Consultation Form')
    .click({ force: true })

  cy.url({ timeout: 30000 }).should('include', '/opd/consultation/encounter')
  cy.contains('Physical Examination', { timeout: 30000 }).should('exist')
}

describe('Consultation worklist', () => {
  beforeEach(() => {
    cy.session('consultation-worklist', () => {
      login()
    })
    openPage(ROUTES.consultation, /Consultation/i)
  })

  it('should render the worklist with every expected column', () => {
    expectListShell()

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      EXPECTED_COLUMNS.forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should show the visit-stage counters', () => {
    cy.contains(/Awaiting Consultation/i).should('exist')
    cy.contains(/Awaiting Investigation/i).should('exist')
    cy.contains(/Investigation Completed/i).should('exist')
    cy.contains(/Visit Completed/i).should('exist')
  })

  it('should switch to Attended and back to Waiting', () => {
    switchTab('Patients Attended To')
    cy.get('body').should('not.contain', 'Page not found')

    switchTab('Patients in Waiting')
    cy.get('table').should('exist')
  })

  it('should offer the consultation form on a waiting patient', () => {
    openFirstRowMenu()

    actionMenuItems().then((items) => {
      expect(items).to.include.members(['Fill Consultation Form', 'Dashboard'])
    })

    dismissActionMenu()
  })

  it('should open the encounter form with its five sections', () => {
    openFirstRowMenu()
    cy.get('[data-cy="action-menu"]')
      .contains('button', 'Fill Consultation Form')
      .click({ force: true })

    cy.url({ timeout: 30000 }).should('include', '/opd/consultation/encounter')
    cy.contains('Physical Examination', { timeout: 30000 }).should('exist')
    cy.contains('Presenting Complaints').should('exist')
    cy.contains('Clinical Diagnosis').should('exist')
    cy.contains('Laboratory Test Orders').should('exist')
    cy.contains('Pharmacy Orders').should('exist')
  })

  it('should fill the physical examination section', () => {
    openEncounterForm()

    fillPhysicalExamination()

    // Filling the required date clears the complaint the form raised before.
    cy.get('body').invoke('text').should('not.match', /Encounter date is required/i)
    // The referral select stores a uuid rather than the visible YES/NO text.
    cy.get('[id="select-is-this-visit-a-referral?"]').invoke('val').should('not.be.empty')
  })

  it('should add a presenting complaint', () => {
    openEncounterForm()
    fillPhysicalExamination()

    addPresentingComplaint()

    // Added complaints are listed under the section once accepted.
    cy.get('body').invoke('text').should('match', /headache and mild fever/i)
  })

  it('should add a clinical diagnosis', () => {
    openEncounterForm()
    fillPhysicalExamination()
    addPresentingComplaint()

    addClinicalDiagnosis('malaria')

    cy.get('body').should('not.contain', 'Page not found')
    cy.contains('button', 'Add Diagnosis').should('exist')
  })

  it('should require an encounter date before saving', () => {
    openFirstRowMenu()
    cy.get('[data-cy="action-menu"]')
      .contains('button', 'Fill Consultation Form')
      .click({ force: true })

    cy.contains('Physical Examination', { timeout: 30000 }).should('exist')

    // Answer only the referral question, leaving the required date empty.
    cy.get('[id="select-is-this-visit-a-referral?"]', { timeout: 20000 }).select('NO', { force: true })
    cy.contains('button', 'Save').click({ force: true })

    cy.contains(/Encounter date is required/i, { timeout: 20000 }).should('exist')
    cy.url().should('include', '/opd/consultation/encounter')
  })
})
