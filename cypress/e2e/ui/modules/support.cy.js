import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'

// Support is routed but unbuilt. Covered so that when it ships, this spec fails
// and the new surface gets real coverage rather than being missed.

describe('Support', () => {
  beforeEach(() => {
    cy.session('support', () => {
      login()
    })
    openPage(ROUTES.support, /Coming Soon/i)
  })

  it('should state the feature is not available yet', () => {
    cy.contains(/Coming Soon/i).should('exist')
    cy.contains(/currently un/i).should('exist')
  })

  it('should offer a way back', () => {
    cy.contains('button', 'Go Back').should('exist')
  })

  it('should leave the page on Go Back', () => {
    cy.contains('button', 'Go Back').click({ force: true })
    cy.wait(3000)

    cy.get('body').should('not.contain', 'Page not found')
    cy.url().should('not.include', ROUTES.support)
  })
})
