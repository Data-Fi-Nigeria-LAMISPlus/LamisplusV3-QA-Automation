import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'

// Search behaviour on the patient register.

describe('Patients search', () => {
  beforeEach(() => {
    cy.session('patients-search', () => {
      login()
    })
    openPage(ROUTES.patients, /Patients/i)
    cy.get('tbody tr', { timeout: 45000 }).should('have.length.greaterThan', 0)
  })

  it('should filter down to a single row when searching a hospital number', () => {
    // Take the term from the table itself so the test never depends on a
    // particular patient still existing on QA.
    cy.get('tbody tr').first().find('td').eq(0).invoke('text').then((raw) => {
      const hospitalNumber = (raw || '').replace(/\s+/g, ' ').trim()
      expect(hospitalNumber, 'first row has a hospital number').to.not.be.empty

      cy.get('input[placeholder="Search..."]')
        .clear({ force: true })
        .type(hospitalNumber, { force: true, delay: 40 })
      cy.wait(2500)

      cy.get('tbody tr').should('have.length', 1)
      cy.contains('tbody tr', hospitalNumber).should('exist')
    })
  })

  it('should match on patient name as well as hospital number', () => {
    cy.get('tbody tr').first().find('td').eq(1).invoke('text').then((raw) => {
      const name = (raw || '').replace(/\s+/g, ' ').trim().split(' ')[0]
      expect(name, 'first row has a patient name').to.not.be.empty

      cy.get('input[placeholder="Search..."]')
        .clear({ force: true })
        .type(name, { force: true, delay: 40 })
      cy.wait(2500)

      cy.get('tbody tr').should('have.length.greaterThan', 0)
      cy.get('tbody').invoke('text').should('include', name)
    })
  })

  it('should report no matches for a value that cannot exist', () => {
    cy.get('input[placeholder="Search..."]')
      .clear({ force: true })
      .type('ZZZ-NO-SUCH-PATIENT-0000', { force: true, delay: 20 })
    cy.wait(3000)

    cy.get('tbody').invoke('text').should('match', /no data|no record|no result/i)
  })

  it('should restore the full list when the search is cleared', () => {
    cy.get('tbody tr').its('length').then((originalCount) => {
      cy.get('input[placeholder="Search..."]')
        .clear({ force: true })
        .type('ZZZ-NO-SUCH-PATIENT-0000', { force: true, delay: 20 })
      cy.wait(2500)

      cy.get('input[placeholder="Search..."]').clear({ force: true })
      cy.wait(3000)

      cy.get('tbody tr').its('length').should('eq', originalCount)
    })
  })
})
