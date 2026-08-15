import { login } from '../../../support/modules/login'
import { ROUTES, openHubCard, openPage } from '../../../support/modules/app-nav'

// The OPD launcher. Its three tiles are clickable divs with no href, so they are
// reached by card text rather than by link.

const CARDS = [
  { label: 'Triage', path: '/opd/triage', heading: /Triage/i },
  { label: 'Consultation', path: '/opd/consultation', heading: /Consultation/i },
  { label: 'Radiology', path: '/opd/radiology', heading: /Radiology Services/i },
]

describe('OPD hub', () => {
  beforeEach(() => {
    cy.session('opd-hub', () => {
      login()
    })
    openPage(ROUTES.opd, /Out Patient Department/i)
  })

  it('should show all three service tiles', () => {
    CARDS.forEach(({ label }) => {
      cy.contains(label).should('exist')
    })
  })

  CARDS.forEach(({ label, path, heading }) => {
    it(`should open ${label} from its tile`, () => {
      openHubCard(label)

      cy.url({ timeout: 30000 }).should('include', path)
      cy.contains(heading, { timeout: 30000 }).should('exist')
    })
  })
})
