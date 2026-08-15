import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'
import {
  fillPharmacyOrder,
  fillPhysicalExamination,
  openConsultationEncounter,
  openSection,
} from '../../../support/modules/encounter-form'

// Prescribing a medication - the pharmacy form.
//
// Like lab orders, prescriptions originate in the consultation encounter form
// (section 5, "Pharmacy Orders"), not on /pharmacy - that page is the
// pharmacist's queue of prescriptions already written, covered read-only by
// pharmacy.cy.js.
//
// The section is a chain: Medication Name -> Formulation -> Strength, each
// populated from the one before it, plus two independent codeset selects (Route
// of Admin, Frequency), Dosage Amount, Duration in days and the prescription
// date. Every select is a react-select with no id and no label/for pair, so they
// are resolved through the label next to them - never by index, which shifts
// with how many sections are open (with only 1 and 5 expanded, Medication Name
// is react-select-3, not the 11 the old field map claimed).
//
// Quantity Prescribed is disabled on this build: it is derived, not entered.

describe('Pharmacy order', () => {
  beforeEach(() => {
    cy.session('pharmacy-order', () => {
      login()
    })
    openPage(ROUTES.consultation, /Consultation/i)
  })

  it('should show the prescribing controls', () => {
    openConsultationEncounter()
    openSection('Pharmacy Orders')

    ;[
      'Prescription Date',
      'Medication Name',
      'Formulation',
      'Route of Admin',
      'Strength',
      'Dosage Amount',
      'Frequency',
      'Quantity Prescribed',
      'Duration in days',
    ].forEach((field) => cy.contains('label', field).should('exist'))

    cy.contains('button', 'Add Pharmacy').should('exist')
  })

  it('should refuse to add a prescription with no drug chosen', () => {
    openConsultationEncounter()
    openSection('Pharmacy Orders')

    // The dependent selects advertise their own precondition, and the button
    // stays disabled until a drug is picked.
    cy.contains(/select a drug first/i).should('exist')
    cy.contains(/select a formulation first/i).should('exist')
    cy.contains('button', 'Add Pharmacy').should('be.disabled')
  })

  it('should derive the quantity rather than accept one', () => {
    openConsultationEncounter()
    openSection('Pharmacy Orders')

    cy.get('input[placeholder="Quantity"]').should('be.disabled')
  })

  it('should prescribe a medication', () => {
    openConsultationEncounter()
    fillPhysicalExamination()

    fillPharmacyOrder({ dosageAmount: 2, durationInDays: 5 })

    cy.contains('button', 'Add Pharmacy', { timeout: 20000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(2500)

    // Accepted orders become chips under the fields, and the form clears itself
    // ready for the next drug. A rejected one leaves a duplicate complaint
    // instead, so both are asserted.
    cy.get('body').should('not.contain', 'Page not found')
    cy.get('body').should(($body) => {
      expect(($body.text() || '').replace(/\s+/g, ' '), 'no duplicate complaint')
        .to.not.match(/has already been added/i)
    })

    cy.get('@pharmacyDrug').then((drug) => {
      cy.contains(drug, { timeout: 20000 }).should('exist')
    })

    cy.screenshot('pharmacy-order-added')
  })
})
