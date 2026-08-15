import { login } from '../../../support/modules/login'
import {
  ROUTES,
  actionMenuItems,
  dismissActionMenu,
  openFirstRowMenu,
  openPage,
} from '../../../support/modules/app-nav'

// The row action menu on the patient register.
//
// Deliberately does NOT activate Delete. It is offered on real QA patient
// records with no undo, so its presence is asserted and nothing more.

describe('Patients row actions', () => {
  beforeEach(() => {
    cy.session('patients-row-actions', () => {
      login()
    })
    openPage(ROUTES.patients, /Patients/i)
  })

  it('should offer the expected actions', () => {
    openFirstRowMenu()

    actionMenuItems().then((items) => {
      expect(items).to.include.members(['Dashboard', 'View', 'Edit', 'Emergency Admission', 'Delete'])
    })

    dismissActionMenu()
  })

  it('should open the patient dashboard from Dashboard', () => {
    openFirstRowMenu()
    cy.get('[data-cy="action-menu"]').contains('button', 'Dashboard').click({ force: true })

    cy.contains('Patient Dashboard', { timeout: 30000 }).should('exist')
    cy.contains('button', 'Post Patient', { timeout: 20000 }).should('exist')
  })

  it('should open a read-only record from View', () => {
    openFirstRowMenu()
    cy.get('[data-cy="action-menu"]').contains('button', 'View').click({ force: true })

    cy.get('body', { timeout: 30000 }).should('not.contain', 'Page not found')
    cy.get('input[name="firstName"]', { timeout: 30000 }).should('exist').and('be.disabled')
  })

  it('should open an editable record prefilled from Edit', () => {
    openFirstRowMenu()
    cy.get('[data-cy="action-menu"]').contains('button', 'Edit').click({ force: true })

    cy.get('input[name="firstName"]', { timeout: 30000 })
      .should('exist')
      .and('not.be.disabled')
      .invoke('val')
      .should('not.be.empty')
  })
})
