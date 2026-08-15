import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'

// User management. Read-only coverage on purpose: creating, editing or
// deactivating users on QA affects everyone else who signs in there.

describe('Administration - user management', () => {
  beforeEach(() => {
    cy.session('administration-users', () => {
      login()
    })
    openPage(ROUTES.users, /User Management/i)
  })

  it('should render the users list', () => {
    cy.contains(/Users List/i).should('exist')
    cy.get('body').should('not.contain', 'Page not found')
  })

  it('should list the signed-in facility admin among the users', () => {
    const email = Cypress.env('EMAIL')

    cy.get('body', { timeout: 30000 })
      .invoke('text')
      .should('include', email.split('@')[0])
  })
})
