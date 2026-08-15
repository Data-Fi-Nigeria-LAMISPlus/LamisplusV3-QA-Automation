import { login } from '../../../support/modules/login'

// Drives the left sidebar the way a user does - clicking each panel item rather
// than visiting URLs directly - and checks the destination plus the active
// highlight. Class names are hashed CSS modules, so the active state is matched
// on [class*="active"].

const SIDEBAR = [
  { label: 'Dashboard', path: '/dashboard', heading: /Dashboard/i },
  { label: 'Patients', path: '/patients', heading: /Patients/i },
  { label: 'OPD', path: '/opd', heading: /Out Patient Department/i },
  { label: 'Laboratory', path: '/laboratory', heading: /Laboratory/i },
  { label: 'Pharmacy', path: '/pharmacy', heading: /Pharmacy/i },
  { label: 'Public Health', path: '/pbh', heading: /Public Health Services/i },
  { label: 'Inpatient Care', path: '/ipc', heading: /INPATIENT/i },
  { label: 'Administration', path: '/tenant/administration', heading: /Administration/i },
  { label: 'Support', path: '/tenant/support', heading: /Coming Soon/i },
]

describe('Sidebar navigation', () => {
  beforeEach(() => {
    cy.session('sidebar-nav', () => {
      login()
    })
    cy.visit('/dashboard')
    cy.contains('h1', 'Dashboard', { timeout: 30000 }).should('exist')
  })

  it('should list every expected item in the sidebar', () => {
    SIDEBAR.forEach(({ label, path }) => {
      cy.get(`a[href="${path}"]`).should('contain.text', label)
    })
  })

  SIDEBAR.forEach(({ label, path, heading }) => {
    it(`should navigate to ${label} from the sidebar`, () => {
      cy.get(`a[href="${path}"]`, { timeout: 20000 }).click({ force: true })

      cy.url({ timeout: 30000 }).should('include', path)
      cy.contains(heading, { timeout: 30000 }).should('exist')

      // The clicked entry becomes the highlighted one.
      cy.get(`a[href="${path}"]`).should('have.attr', 'class').and('match', /active/)
    })
  })
})
