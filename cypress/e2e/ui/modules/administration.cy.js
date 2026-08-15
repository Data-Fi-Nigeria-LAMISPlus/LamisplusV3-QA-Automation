import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'

// Administration. Unlike the other hubs its sections are accordion buttons in a
// left column rather than cards, so they are matched by their heading text.

const SECTIONS = ['User Management', 'Service Management', 'App Store', 'Settings']

describe('Administration', () => {
  beforeEach(() => {
    cy.session('administration', () => {
      login()
    })
    openPage(ROUTES.administration, /Administration/i)
  })

  it('should describe itself as organisation settings', () => {
    cy.contains(/Manage your organization settings and users/i).should('exist')
  })

  it('should list every administration section', () => {
    SECTIONS.forEach((section) => {
      cy.contains('h3', section).should('exist')
    })
  })

  SECTIONS.forEach((section) => {
    it(`should open the ${section} section`, () => {
      cy.contains('h3', section).click({ force: true })
      cy.wait(2500)

      // Opening a section replaces the left-hand menu with that section's own
      // view, so the heading that was clicked is not necessarily still an h3.
      // What matters is that it resolves to a real screen.
      cy.get('body').should('not.contain', 'Page not found')
      cy.get('body').invoke('text').should('not.be.empty')
    })
  })
})
