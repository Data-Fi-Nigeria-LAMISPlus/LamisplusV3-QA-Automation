import { login } from '../../../support/modules/login'
import { ROUTES, expectListShell, openPage, switchTab } from '../../../support/modules/app-nav'

// The patient register table itself: shell, columns, tabs, registration entry.
// Search lives in patients-search.cy.js and the row menu in
// patients-row-actions.cy.js.

const EXPECTED_COLUMNS = [
  'Hospital No.',
  'Patient Name',
  'Sex',
  'Age',
  'Date of Birth',
  'Registration Date',
  'Phone',
  'Actions',
]

describe('Patients list', () => {
  beforeEach(() => {
    cy.session('patients-list', () => {
      login()
    })
    openPage(ROUTES.patients, /Patients/i)
  })

  it('should render the patient table with every expected column', () => {
    expectListShell()

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      EXPECTED_COLUMNS.forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should load at least one patient row', () => {
    cy.get('tbody tr', { timeout: 45000 }).should('have.length.greaterThan', 0)
  })

  it('should offer the registration entry point and both population tabs', () => {
    cy.contains('button', 'Register Patient').should('exist')
    cy.contains('button', 'New Registrations').should('exist')
    cy.contains('button', 'Checked-In Patients').should('exist')
  })

  it('should open the registration form from Register Patient', () => {
    cy.contains('button', 'Register Patient').click({ force: true })

    cy.url({ timeout: 30000 }).should('include', '/patients/register')
    cy.get('input[name="firstName"]', { timeout: 30000 }).should('exist')
  })

  it('should switch to Checked-In Patients and back', () => {
    switchTab('Checked-In Patients')
    cy.get('table').should('exist')
    cy.get('body').should('not.contain', 'Page not found')

    switchTab('New Registrations')
    cy.get('table').should('exist')
  })
})
