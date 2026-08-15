import { login } from '../../../support/modules/login'
import { ROUTES, openHubCard, openPage } from '../../../support/modules/app-nav'

// The Public Health launcher and each programme tile it routes to.

const PROGRAMMES = [
  { label: 'HIV', path: '/pbh/hiv' },
  { label: 'TB', path: '/pbh/tb' },
  { label: 'Immunization', path: '/pbh/immunization' },
  { label: 'Intensive & Specialized Care', path: '/pbh/' },
  { label: 'Malaria', path: '/pbh/malaria' },
  { label: 'Nutrition Services', path: '/pbh/nutrition' },
  { label: 'MCH', path: '/pbh/mch' },
  { label: 'Family Planning', path: '/pbh/family-planning' },
]

describe('Public Health hub', () => {
  beforeEach(() => {
    cy.session('pbh-hub', () => {
      login()
    })
    openPage(ROUTES.publicHealth, /Public Health Services/i)
  })

  it('should show every programme tile', () => {
    PROGRAMMES.forEach(({ label }) => {
      cy.contains(label).should('exist')
    })
  })

  PROGRAMMES.forEach(({ label, path }) => {
    it(`should open ${label} from its tile`, () => {
      openHubCard(label)

      cy.url({ timeout: 30000 }).should('include', path)
      cy.get('body', { timeout: 30000 }).should('not.contain', 'Page not found')
    })
  })
})
