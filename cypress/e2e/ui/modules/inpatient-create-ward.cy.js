import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'

// The Create New Ward form (a modal on the bed-management page).
//
// Fills and validates but deliberately does not submit: every run would
// otherwise add a permanent ward to the QA facility, and there is no cleanup
// step to remove them.

describe('Inpatient - Create Ward form', () => {
  beforeEach(() => {
    cy.session('ipc-create-ward', () => {
      login()
    })
    openPage(ROUTES.bedManagement, /Bed Management/i)
    cy.contains('button', 'Create Ward').click({ force: true })
    cy.contains('Create New Ward', { timeout: 20000 }).should('exist')
  })

  it('should show every required ward field', () => {
    cy.get('[id="input-ward-name*"]').should('exist')
    cy.get('[id="input-floor-number*"]').should('exist')
    cy.get('[id="input-building-block*"]').should('exist')
    cy.get('[id="select-gender-policy*"]').should('exist')
    cy.contains('button', 'Cancel').should('exist')
  })

  it('should offer the documented gender policies', () => {
    cy.get('[id="select-gender-policy*"]').then(($select) => {
      const options = [...$select[0].options].map((option) => option.text.trim())
      expect(options).to.include.members(['Male Only', 'Female Only', 'Mixed'])
    })
  })

  it('should accept ward details being filled in', () => {
    cy.get('[id="input-ward-name*"]').clear({ force: true }).type('QA Automation Ward', { force: true })
    cy.get('[id="input-floor-number*"]').clear({ force: true }).type('1st Floor', { force: true })
    cy.get('[id="input-building-block*"]').clear({ force: true }).type('Block A', { force: true })
    cy.get('[id="select-gender-policy*"]').select('Mixed', { force: true })

    cy.get('[id="input-ward-name*"]').should('have.value', 'QA Automation Ward')
    // The policy select stores a uuid, so assert something was chosen rather
    // than a particular value.
    cy.get('[id="select-gender-policy*"]').invoke('val').should('not.be.empty')
  })

  it('should close without creating anything on Cancel', () => {
    cy.get('[id="input-ward-name*"]').clear({ force: true }).type('QA Discarded Ward', { force: true })
    cy.contains('button', 'Cancel').click({ force: true })
    cy.wait(2000)

    cy.contains('Create New Ward').should('not.exist')
    cy.contains(/Bed Management/i).should('exist')
  })
})
