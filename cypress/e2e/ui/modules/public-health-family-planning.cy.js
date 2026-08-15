import { login } from '../../../support/modules/login'
import { ROUTES, openPage, switchTab } from '../../../support/modules/app-nav'

// Family Planning services worklist.

describe('Public Health - Family Planning', () => {
  beforeEach(() => {
    cy.session('pbh-family-planning', () => {
      login()
    })
    openPage(ROUTES.familyPlanning, /Family Planning Services/i)
  })

  it('should render the worklist shell', () => {
    cy.get('table', { timeout: 45000 }).should('exist')
    cy.get('input[placeholder="Search..."]').should('exist')

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Name', 'Sex', 'Age', 'Actions'].forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should offer the waiting and enrolled queues', () => {
    cy.contains('button', 'Patients in Waiting').should('exist')
    cy.contains('button', 'Enrolled Patients').should('exist')
  })

  it('should switch to Enrolled Patients and back', () => {
    switchTab('Enrolled Patients')
    cy.get('body').should('not.contain', 'Page not found')

    switchTab('Patients in Waiting')
    cy.get('table').should('exist')
  })
})
