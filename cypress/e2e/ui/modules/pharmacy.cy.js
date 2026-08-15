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

// Pharmacy: the prescription queue, its three stages and its counters.

const TABS = ['Prescription Order', 'Dispensing Information', 'Medication Details']

describe('Pharmacy', () => {
  beforeEach(() => {
    cy.session('pharmacy', () => {
      login()
    })
    openPage(ROUTES.pharmacy, /Pharmacy/i)
  })

  it('should render the prescription list with its expected columns', () => {
    expectListShell()

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Patient Name', 'Sex', 'Order Date'].forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should show the dispensing counters', () => {
    cy.contains(/Prescription Order/i).should('exist')
    cy.contains(/Patients Dispensed to/i).should('exist')
  })

  it('should offer all three workflow stages', () => {
    TABS.forEach((tab) => cy.contains('button', tab).should('exist'))
  })

  TABS.forEach((tab) => {
    it(`should open the ${tab} stage`, () => {
      switchTab(tab)

      cy.get('body').should('not.contain', 'Page not found')
      cy.url().should('include', ROUTES.pharmacy)
      cy.contains('button', tab).should('exist')
    })
  })

  it('should offer the patient dashboard on a prescription row', () => {
    openFirstRowMenu()

    actionMenuItems().then((items) => {
      expect(items).to.include('Dashboard')
    })

    dismissActionMenu()
  })

  it('should filter prescriptions by patient name', () => {
    cy.get('tbody tr', { timeout: 45000 }).should('have.length.greaterThan', 0)

    cy.get('tbody tr').first().find('td').eq(0).invoke('text').then((raw) => {
      const name = (raw || '').replace(/\s+/g, ' ').trim().split(' ')[0]

      cy.get('input[placeholder="Search..."]')
        .clear({ force: true })
        .type(name, { force: true, delay: 40 })
      cy.wait(2500)

      cy.get('tbody').invoke('text').should('include', name)
    })
  })
})
