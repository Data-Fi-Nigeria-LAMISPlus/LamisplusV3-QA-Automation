import { login } from '../../../support/modules/login'
import {
  ROUTES,
  openPage,
} from '../../../support/modules/app-nav'
import {
  chooseByLabel,
  chooseByPlaceholder,
  fillPhysicalExamination,
  openConsultationEncounter,
  openSection,
} from '../../../support/modules/encounter-form'

// Ordering a laboratory test.
//
// Orders originate in section 4 of the consultation encounter form, not on
// /laboratory - that page is the lab's own worklist of orders already placed
// (covered read-only by laboratory.cy.js).
//
// The four controls are react-selects with no labels, numbered in DOM order once
// the section is open: 7 and 8 are the test type and test name, 9 and 10 the
// specimen type and priority. 9 is dependent - it reads "select a test first"
// until a test is chosen - so they are filled in order and each option list is
// waited for.

describe('Laboratory test order', () => {
  beforeEach(() => {
    cy.session('lab-test-order', () => {
      login()
    })
    openPage(ROUTES.consultation, /Consultation/i)
  })

  it('should show the laboratory ordering controls', () => {
    openConsultationEncounter()
    openSection('Laboratory Test Orders')

    cy.contains(/Test Name/i).should('exist')
    cy.contains(/Specimen Type/i).should('exist')
    cy.contains('button', 'Add Lab').should('exist')
  })

  it('should report that specimen type needs a test chosen first', () => {
    openConsultationEncounter()
    openSection('Laboratory Test Orders')

    // The dependent control advertises its own precondition.
    cy.contains(/select a test first/i).should('exist')
  })

  it('should order a laboratory test', () => {
    openConsultationEncounter()
    fillPhysicalExamination()
    openSection('Laboratory Test Orders')

    // Never by index: react-select numbering shifts with which sections are open.
    // Lab Test Type has no placeholder, so it is found by its label; the others
    // are matched on their placeholder text.
    //
    // Test Name drives this section: it is the only control with options on
    // arrival. Lab Test Type and Specimen Type are both populated from the chosen
    // test, so opening Lab Test Type first finds an empty option list.
    chooseByPlaceholder('specific test name')
    chooseByLabel('Specimen Type')
    chooseByPlaceholder('urgency of the test')

    cy.contains('button', 'Add Lab', { timeout: 20000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(2500)

    // Once accepted the order is listed in the section and the button flips to
    // an update label.
    cy.get('body').should('not.contain', 'Page not found')
    cy.contains(/Add Lab|Update Lab/i).should('exist')
  })
})
