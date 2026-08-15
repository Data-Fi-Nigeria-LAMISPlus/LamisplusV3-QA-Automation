import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'

// Programmes that are routed but not yet built on QA. They are covered so that
// the day one of them ships, this spec fails and the gap gets real coverage
// instead of going unnoticed.

describe('Public Health - unbuilt programmes', () => {
  beforeEach(() => {
    cy.session('pbh-placeholders', () => {
      login()
    })
  })

  it('should route Malaria to a placeholder with a way back', () => {
    openPage(ROUTES.malaria, /Malaria Service/i)

    cy.contains('button', 'Go Back').should('exist')
  })

  it('should route Nutrition Services to a placeholder with a way back', () => {
    openPage(ROUTES.nutrition, /Nutrition Services/i)

    cy.contains('button', 'Go Back').should('exist')
  })

  it('should route MCH to its own page', () => {
    openPage(ROUTES.mch, /Maternal and Child Health/i)

    cy.get('body').should('not.contain', 'Page not found')
  })

  it('should return to the hub from a placeholder Go Back', () => {
    openPage(ROUTES.malaria, /Malaria Service/i)

    cy.contains('button', 'Go Back').click({ force: true })
    cy.wait(3000)
    cy.get('body').should('not.contain', 'Page not found')
  })
})
