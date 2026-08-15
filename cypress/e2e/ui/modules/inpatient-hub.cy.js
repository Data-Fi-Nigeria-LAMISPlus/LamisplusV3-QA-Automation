import { login } from '../../../support/modules/login'
import { ROUTES, openHubCard, openPage } from '../../../support/modules/app-nav'

// The Inpatient Care launcher and its three tiles.

const CARDS = [
  { label: 'Admissions', path: '/ipc/admissions', heading: /Admissions to In-Patient Services/i },
  { label: 'Bed Management', path: '/ipc/bed-management', heading: /Bed Management/i },
  { label: 'Discharge', path: '/ipc/discharge', heading: /Discharge Overview/i },
]

describe('Inpatient hub', () => {
  beforeEach(() => {
    cy.session('ipc-hub', () => {
      login()
    })
    openPage(ROUTES.inpatient, /INPATIENT/i)
  })

  it('should show all three inpatient tiles', () => {
    CARDS.forEach(({ label }) => cy.contains(label).should('exist'))
  })

  CARDS.forEach(({ label, path, heading }) => {
    it(`should open ${label} from its tile`, () => {
      openHubCard(label)

      cy.url({ timeout: 30000 }).should('include', path)
      cy.contains(heading, { timeout: 30000 }).should('exist')
    })
  })
})
