import { login } from '../../../support/modules/login'
import { ROUTES, expectListShell, openPage, switchTab } from '../../../support/modules/app-nav'

// Bed management: the bed inventory, its four views and its counters. The two
// creation forms have their own specs (inpatient-create-ward /
// inpatient-create-bed).

const VIEWS = ['Available Beds', 'Occupied Beds', 'Other Beds', 'Wards']

describe('Inpatient bed management', () => {
  beforeEach(() => {
    cy.session('ipc-bed-management', () => {
      login()
    })
    openPage(ROUTES.bedManagement, /Bed Management/i)
  })

  it('should render the bed inventory with its expected columns', () => {
    expectListShell()

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Bed Code', 'Bed Category', 'Ward', 'Status', 'Actions']
        .forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should show the bed and ward counters', () => {
    cy.contains(/Total Beds/i).should('exist')
    cy.contains(/Total Wards/i).should('exist')
    cy.contains(/Available Beds/i).should('exist')
    cy.contains(/Occupied Beds/i).should('exist')
  })

  it('should offer both creation entry points', () => {
    cy.contains('button', 'Create Ward').should('exist')
    cy.contains('button', 'Create Bed').should('exist')
  })

  it('should offer every inventory view', () => {
    VIEWS.forEach((view) => cy.contains('button', view).should('exist'))
  })

  VIEWS.forEach((view) => {
    it(`should open the ${view} view`, () => {
      switchTab(view)

      cy.get('body').should('not.contain', 'Page not found')
      cy.url().should('include', ROUTES.bedManagement)
      cy.contains('button', view).should('exist')
    })
  })
})
