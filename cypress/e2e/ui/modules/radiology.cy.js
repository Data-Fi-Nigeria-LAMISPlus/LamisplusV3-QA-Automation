import { login } from '../../../support/modules/login'
import {
  ROUTES,
  actionMenuItems,
  dismissActionMenu,
  openFirstRowMenu,
  openPage,
  switchTab,
} from '../../../support/modules/app-nav'

// Radiology orders. Unlike the other worklists this page ships no search box, so
// the shared list-shell helper is not used here.

const EXPECTED_COLUMNS = [
  'Order ID',
  'Body Part',
  'Indication',
  'Order Date',
  'Priority',
  'Appointment Date',
  'Actions',
]

describe('Radiology', () => {
  beforeEach(() => {
    cy.session('radiology', () => {
      login()
    })
    openPage(ROUTES.radiology, /Radiology Services/i)
  })

  it('should render the order list with every expected column', () => {
    cy.get('table', { timeout: 45000 }).should('exist')

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      EXPECTED_COLUMNS.forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should offer both order queues', () => {
    cy.contains('button', 'Orders in Waiting').should('exist')
    cy.contains('button', 'Completed Orders').should('exist')
  })

  it('should switch to Completed Orders and back', () => {
    switchTab('Completed Orders')
    cy.get('body').should('not.contain', 'Page not found')

    switchTab('Orders in Waiting')
    cy.get('table').should('exist')
  })

  it('should offer scheduling and editing on an order row', () => {
    openFirstRowMenu()

    actionMenuItems().then((items) => {
      expect(items).to.include.members(['Schedule Order', 'Edit Order'])
    })

    dismissActionMenu()
  })
})
