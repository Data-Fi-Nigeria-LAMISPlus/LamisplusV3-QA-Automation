import { login } from '../../../support/modules/login'
import { ROUTES, openPage, switchTab } from '../../../support/modules/app-nav'

// The facility dashboard: its six report tabs and the summary widgets.

const TABS = [
  'General',
  'HIV Care and Treatment',
  'Family Planning',
  'MCH',
  'Laboratory Services',
  'Pharmacy Services',
]

describe('Dashboard', () => {
  beforeEach(() => {
    cy.session('dashboard', () => {
      login()
    })
    openPage(ROUTES.dashboard, /Dashboard/i)
  })

  it('should show the registered-patient count and summary widgets', () => {
    cy.contains(/No\. of Patients Registered/i).should('exist')
    cy.contains(/Admitted Patients/i).should('exist')
    cy.contains(/Discharged Patients/i).should('exist')
    cy.contains('Patient Overview').should('exist')
    cy.contains('Patients by Age Group').should('exist')
    cy.contains('Prescription Report').should('exist')
  })

  it('should report a numeric registered-patient total', () => {
    cy.contains(/No\. of Patients Registered/i)
      .parent()
      .invoke('text')
      .should('match', /\d/)
  })

  it('should offer every report tab', () => {
    TABS.forEach((tab) => {
      cy.contains('button', tab).should('exist')
    })
  })

  TABS.forEach((tab) => {
    it(`should open the ${tab} tab`, () => {
      switchTab(tab)

      // Tab content varies, so assert the switch itself held rather than
      // guessing at widgets: we are still on the dashboard and nothing 404'd.
      cy.url().should('include', ROUTES.dashboard)
      cy.get('body').should('not.contain', 'Page not found')
      cy.contains('button', tab).should('exist')
    })
  })
})
