import { login } from '../../../support/modules/login'
import { locator, patientRegistration, visitPluginRoute } from '../../../support/modules/patient-flow'
import { ROUTES, openPage, openFirstRowMenu } from '../../../support/modules/app-nav'

// Registering a patient by filling the whole form.
//
// patientRegistration() drives every accordion section - Bio Data, Registration
// Details, Next of Kin, Emergency Contact, Billing Information - and asserts the
// create request came back 2xx, so a server rejection names the offending field
// instead of the test only noticing a missing row afterwards.
//
// Worth knowing about the deployed form, all handled inside that helper:
//  - Date of Registration is a read-only MUI picker; typing is a no-op, the value
//    has to come from the calendar
//  - Date of Birth is driven as "Estimated" with an age, because the calendar
//    disables future months and can therefore only land on today, which the API
//    rejects as age 0
//  - Country/State/LGA are react-select comboboxes that cascade, each unlocking
//    the next

describe('Patient registration', () => {
  beforeEach(() => {
    cy.session('patient-register', () => {
      login()
    })
  })

  it('should open the registration form with every section', () => {
    visitPluginRoute('/patients/register', locator.FIRST_NAME_INPUT)

    cy.contains('button', 'Bio Data').should('exist')
    cy.contains('button', 'Registration Details').should('exist')
    cy.contains('button', 'Next of Kin Details').should('exist')
    cy.contains('button', 'Emergency Contact').should('exist')
    cy.contains('button', 'Billing Information').should('exist')
    cy.contains('button', 'Save').should('exist')
  })

  it('should fill the whole form and register the patient', () => {
    const hospitalNumber = patientRegistration()

    // Registered means findable in the register, not just an accepted request.
    openPage(ROUTES.patients, /Patients/i)
    cy.get('input[placeholder="Search..."]', { timeout: 20000 })
      .clear({ force: true })
      .type(hospitalNumber, { force: true, delay: 40 })
    cy.wait(2500)

    cy.contains('tbody tr', hospitalNumber, { timeout: 30000 }).should('exist')
  })

  it('should keep the details it was given', () => {
    const hospitalNumber = patientRegistration()

    openPage(ROUTES.patients, /Patients/i)
    cy.get('input[placeholder="Search..."]', { timeout: 20000 })
      .clear({ force: true })
      .type(hospitalNumber, { force: true, delay: 40 })
    cy.wait(2500)

    // The row carries back what was entered.
    cy.contains('tbody tr', hospitalNumber)
      .invoke('text')
      .should('match', /John/)
      .and('match', /Doe/)

    // And the saved record reopens with the same values.
    openFirstRowMenu()
    cy.get('[data-cy="action-menu"], body > div[class*="-menu"]')
      .contains('button', 'Edit')
      .click({ force: true })

    cy.get(locator.FIRST_NAME_INPUT, { timeout: 30000 }).should('have.value', 'John')
    cy.get(locator.LAST_NAME_INPUT).should('have.value', 'Doe')
    cy.get(locator.HOSPITAL_NUMBER_INPUT).should('have.value', hospitalNumber)
  })
})
