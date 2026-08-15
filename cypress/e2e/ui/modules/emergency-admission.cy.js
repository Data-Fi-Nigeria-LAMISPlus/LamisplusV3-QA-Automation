import { login } from '../../../support/modules/login'
import { ROUTES, openFirstRowMenu, openPage } from '../../../support/modules/app-nav'

// The Schedule Admission form, reached from Emergency Admission on a patient row.
//
// Stops short of submitting: it would schedule a real admission against a real
// QA patient on every run.

describe('Emergency admission form', () => {
  beforeEach(() => {
    cy.session('emergency-admission', () => {
      login()
    })
    openPage(ROUTES.patients, /Patients/i)

    openFirstRowMenu()
    cy.get('[data-cy="action-menu"]').contains('button', 'Emergency Admission').click({ force: true })
    cy.contains('Schedule Admission', { timeout: 30000 }).should('exist')
  })

  it('should open on its own route for the selected patient', () => {
    cy.url().should('include', '/patients/emergency-admission')
  })

  it('should show both form sections', () => {
    cy.contains('Admission Details').should('exist')
    cy.contains('Admission Conditions').should('exist')
  })

  it('should show the clinician and notes fields with actions', () => {
    cy.get('[id="input-admitting-clinician*"]').should('exist')
    cy.get('#notes').should('exist')
    cy.contains('button', 'Save').should('exist')
    cy.contains('button', 'Cancel').should('exist')
  })

  it('should accept a clinician and admission notes', () => {
    cy.get('[id="input-admitting-clinician*"]')
      .clear({ force: true })
      .type('Dr QA Automation', { force: true })
    cy.get('#notes')
      .clear({ force: true })
      .type('Automated check of the emergency admission form.', { force: true })

    cy.get('[id="input-admitting-clinician*"]').should('have.value', 'Dr QA Automation')
    cy.get('#notes').invoke('val').should('not.be.empty')
  })

  it('should leave without scheduling anything on Cancel', () => {
    cy.get('#notes').clear({ force: true }).type('Discarded by automation.', { force: true })
    cy.contains('button', 'Cancel').click({ force: true })
    cy.wait(2500)

    cy.contains('Schedule Admission').should('not.exist')
  })
})
