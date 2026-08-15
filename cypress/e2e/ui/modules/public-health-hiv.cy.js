import { login } from '../../../support/modules/login'
import { ROUTES, openHubCard, openPage } from '../../../support/modules/app-nav'

// The HIV programme launcher and its five service tiles.

const SERVICES = ['HTS', 'ART ENROLLMENT', 'PrEP SERVICES', 'PMTCT SERVICES', 'VIRAL HEPATITIS SERVICES']

describe('Public Health - HIV', () => {
  beforeEach(() => {
    cy.session('pbh-hiv', () => {
      login()
    })
    openPage(ROUTES.hiv, /HIV/i)
  })

  it('should show every HIV service tile', () => {
    SERVICES.forEach((service) => {
      cy.contains(service).should('exist')
    })
  })

  SERVICES.forEach((service) => {
    it(`should open ${service} without erroring`, () => {
      openHubCard(service)
      cy.wait(4000)

      // Some of these are still placeholders on QA, so this asserts the tile
      // routes somewhere real rather than guessing at each destination's content.
      cy.get('body', { timeout: 30000 }).should('not.contain', 'Page not found')
    })
  })
})
