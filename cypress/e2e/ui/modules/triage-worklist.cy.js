import { login } from '../../../support/modules/login'
import {
  ROUTES,
  actionMenuItems,
  dismissActionMenu,
  expectListShell,
  openFirstRowMenu,
  openPage,
  switchTab,
} from '../../../support/modules/app-nav'

// The triage worklist: its two queues and the row actions. The full
// vitals-capture journey lives in clinical/triage-capture-vitals.cy.js.

const EXPECTED_COLUMNS = [
  'Hospital Number',
  'Patient Name',
  'Sex',
  'Check-in Date',
  'Check-in Time',
  'Service Point',
  'Actions',
]

describe('Triage worklist', () => {
  beforeEach(() => {
    cy.session('triage-worklist', () => {
      login()
    })
    openPage(ROUTES.triage, /Triage/i)
  })

  it('should render the worklist with every expected column', () => {
    expectListShell()

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      EXPECTED_COLUMNS.forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should show both queues and their counts', () => {
    cy.contains('button', 'Patient in Waiting').should('exist')
    cy.contains('button', 'Patient Attended To').should('exist')
    cy.contains(/Patients in Waiting/i).should('exist')
    cy.contains(/Patients Attended To/i).should('exist')
  })

  it('should switch to Attended and back to Waiting', () => {
    switchTab('Patient Attended To')
    cy.get('table').should('exist')
    cy.get('body').should('not.contain', 'Page not found')

    switchTab('Patient in Waiting')
    cy.get('table').should('exist')
  })

  it('should offer Capture Vitals on a waiting patient', () => {
    openFirstRowMenu()

    actionMenuItems().then((items) => {
      expect(items).to.include.members(['Capture Vitals', 'Dashboard'])
    })

    dismissActionMenu()
  })

  it('should offer Post Patient on an attended patient', () => {
    switchTab('Patient Attended To')
    openFirstRowMenu()

    actionMenuItems().then((items) => {
      expect(items).to.include.members(['Post Patient', 'Dashboard'])
    })

    dismissActionMenu()
  })

  it('should open the vitals form from Capture Vitals', () => {
    openFirstRowMenu()
    cy.get('[data-cy="action-menu"]').contains('button', 'Capture Vitals').click({ force: true })

    cy.url({ timeout: 30000 }).should('include', '/opd/triage/record')
    cy.get('input[placeholder="Pulse"]', { timeout: 30000 }).should('exist')
    cy.get('input[placeholder="Temperature"]').should('exist')
    cy.contains('button', 'Save').should('exist')
  })

  it('should filter the worklist by hospital number', () => {
    cy.get('tbody tr', { timeout: 45000 }).should('have.length.greaterThan', 0)

    cy.get('tbody tr').first().find('td').eq(0).invoke('text').then((raw) => {
      const hospitalNumber = (raw || '').replace(/\s+/g, ' ').trim()

      cy.get('input[placeholder="Search..."]')
        .clear({ force: true })
        .type(hospitalNumber, { force: true, delay: 40 })
      cy.wait(2500)

      cy.contains('tbody tr', hospitalNumber).should('exist')
    })
  })
})
