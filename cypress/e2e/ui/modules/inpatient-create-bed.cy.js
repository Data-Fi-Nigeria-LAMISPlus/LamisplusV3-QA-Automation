import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'
import { createBed } from '../../../support/modules/inpatient'

// The Create Bed Space form, which is its own page rather than a modal.
//
// As with wards, this stops short of submitting so runs do not accumulate beds
// on the QA facility.

describe('Inpatient - Create Bed form', () => {
  beforeEach(() => {
    cy.session('ipc-create-bed', () => {
      login()
    })
    openPage(ROUTES.bedManagement, /Bed Management/i)
    cy.contains('button', 'Create Bed').click({ force: true })
    cy.contains('Create Bed Space', { timeout: 20000 }).should('exist')
  })

  it('should open on its own route', () => {
    cy.url().should('include', '/ipc/bed-management/create')
  })

  it('should show the bed code, ward selector and actions', () => {
    cy.get('[id="input-bed-code-*"]').should('exist')
    cy.get('[id="select-ward-*"]').should('exist')
    cy.get('input[placeholder="Search and select equipment"]').should('exist')
    cy.contains('button', 'Save').should('exist')
    cy.contains('button', 'Cancel').should('exist')
  })

  it('should offer at least one ward to assign the bed to', () => {
    cy.get('[id="select-ward-*"]').then(($select) => {
      const selectable = [...$select[0].options].filter((option) => option.value)
      expect(selectable.length, 'wards available to assign').to.be.greaterThan(0)
    })
  })

  it('should accept a bed code and ward selection', () => {
    cy.get('[id="input-bed-code-*"]').clear({ force: true }).type('QA-BED-01', { force: true })

    cy.get('[id="select-ward-*"]').then(($select) => {
      const first = [...$select[0].options].find((option) => option.value)
      cy.wrap($select).select(first.value, { force: true })
    })

    cy.get('[id="input-bed-code-*"]').should('have.value', 'QA-BED-01')
    cy.get('[id="select-ward-*"]').invoke('val').should('not.be.empty')
  })

  // The one test here that actually writes: it creates a bed and confirms it
  // lands in the inventory as Available. createBed() lives in
  // support/modules/inpatient.js because the admission spec needs the same setup.
  it('should create a bed and list it as available', () => {
    const bedCode = createBed()

    openPage(ROUTES.bedManagement, /Bed Management/i)
    cy.get('input[placeholder="Search..."]', { timeout: 20000 })
      .clear({ force: true })
      .type(bedCode, { force: true, delay: 40 })
    cy.wait(2500)

    cy.contains('tbody tr', bedCode, { timeout: 30000 })
      .invoke('text')
      .should('match', /available/i)
  })

  it('should leave without creating anything on Cancel', () => {
    cy.get('[id="input-bed-code-*"]').clear({ force: true }).type('QA-BED-DISCARD', { force: true })
    cy.contains('button', 'Cancel').click({ force: true })
    cy.wait(2500)

    cy.contains('Create Bed Space').should('not.exist')
  })
})
