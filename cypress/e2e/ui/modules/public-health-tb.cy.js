import { login } from '../../../support/modules/login'
import { ROUTES, openHubCard, openPage } from '../../../support/modules/app-nav'

// The TB programme launcher and its two service tiles.

const SERVICES = ['TB SCREENING', 'TB TREATMENT']

describe('Public Health - TB', () => {
  beforeEach(() => {
    cy.session('pbh-tb', () => {
      login()
    })
    openPage(ROUTES.tb, /TB/i)
  })

  it('should show both TB service tiles', () => {
    SERVICES.forEach((service) => {
      cy.contains(service).should('exist')
    })
  })

  SERVICES.forEach((service) => {
    it(`should open ${service} without erroring`, () => {
      openHubCard(service)
      cy.wait(4000)

      cy.get('body', { timeout: 30000 }).should('not.contain', 'Page not found')
    })
  })
})
