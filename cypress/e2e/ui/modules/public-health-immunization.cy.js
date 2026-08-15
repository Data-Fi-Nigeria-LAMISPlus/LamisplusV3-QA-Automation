import { login } from '../../../support/modules/login'
import { ROUTES, openPage, switchTab } from '../../../support/modules/app-nav'

// Routine Immunization worklist. Its queues are usually empty on QA, so this
// asserts the shell and the queue switch rather than requiring rows.

describe('Public Health - Immunization', () => {
  beforeEach(() => {
    cy.session('pbh-immunization', () => {
      login()
    })
    openPage(ROUTES.immunization, /Routine Immunization/i)
  })

  it('should render the worklist shell', () => {
    cy.get('table', { timeout: 45000 }).should('exist')
    cy.get('input[placeholder="Search..."]').should('exist')

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Patient Name', 'Sex', 'Age', 'Actions'].forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should show both queues and their counters', () => {
    cy.contains('button', 'Patients in Waiting').should('exist')
    cy.contains('button', 'Patients Attended To').should('exist')
  })

  it('should switch to Attended and back to Waiting', () => {
    switchTab('Patients Attended To')
    cy.get('body').should('not.contain', 'Page not found')

    switchTab('Patients in Waiting')
    cy.get('table').should('exist')
  })
})
