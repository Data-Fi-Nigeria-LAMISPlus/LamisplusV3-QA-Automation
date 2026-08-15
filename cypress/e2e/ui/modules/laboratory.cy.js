import { login } from '../../../support/modules/login'
import {
  ROUTES,
  actionMenuItems,
  dismissActionMenu,
  expectListShell,
  openFirstRowMenu,
  openPage,
  switchTab,
} from '../../../support/modules/app-nav'

// Laboratory: the ordered-tests list, its three stages and its stage counters.

const EXPECTED_COLUMNS = [
  'Hospital Number',
  'Patient Name',
  'Sex',
  'Age',
  'Date of Visit',
  'Order Date',
  'Ordering Clinician',
  'Tests Ordered',
  'Tests Completed',
]

const TABS = ['Tests Ordered', 'Sample Information', 'Test Result']

describe('Laboratory', () => {
  beforeEach(() => {
    cy.session('laboratory', () => {
      login()
    })
    openPage(ROUTES.laboratory, /Laboratory/i)
  })

  it('should render the orders list with every expected column', () => {
    expectListShell()

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      EXPECTED_COLUMNS.forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should show the workflow counters', () => {
    cy.contains(/Tests Ordered/i).should('exist')
    cy.contains(/Sample Information/i).should('exist')
    cy.contains(/In Progress/i).should('exist')
    cy.contains(/Results Reported/i).should('exist')
  })

  it('should offer all three workflow stages', () => {
    TABS.forEach((tab) => cy.contains('button', tab).should('exist'))
  })

  TABS.forEach((tab) => {
    it(`should open the ${tab} stage`, () => {
      switchTab(tab)

      cy.get('body').should('not.contain', 'Page not found')
      cy.url().should('include', ROUTES.laboratory)
      cy.contains('button', tab).should('exist')
    })
  })

  it('should offer the patient dashboard on an order row', () => {
    openFirstRowMenu()

    actionMenuItems().then((items) => {
      expect(items).to.include('Dashboard')
    })

    dismissActionMenu()
  })

  it('should filter orders by hospital number', () => {
    cy.get('tbody tr', { timeout: 45000 }).should('have.length.greaterThan', 0)

    cy.get('tbody tr').first().find('td').eq(0).invoke('text').then((raw) => {
      const hospitalNumber = (raw || '').replace(/\s+/g, ' ').trim()

      cy.get('input[placeholder="Search..."]')
        .clear({ force: true })
        .type(hospitalNumber, { force: true, delay: 40 })
      cy.wait(2500)

      cy.contains('tbody tr', hospitalNumber).should('exist')
    })
  })
})
