import { login } from '../../../support/modules/login'
import { patientRegistration } from '../../../support/modules/patient-flow'
import { openRowActionMenu, routes } from '../../../support/modules/opd-consultation-fill-form'

// Registration, then proof the patient is actually retrievable from the list -
// the smoke suite asserts the create request succeeded, this asserts the record
// surfaces in the UI afterwards.
//
// Previously an unreferenced describe() block in support/modules/, written
// against '/ehr/registration/register' with MUI Autocomplete pickers. Retargeted
// to the deployed form via the shared registration module.

describe('Patient Registration', () => {
  beforeEach(() => {
    cy.session('clinical-patient-registration', () => {
      login()
    })
  })

  it('should register a patient and find it in the patient list', () => {
    const hospitalNumber = patientRegistration()

    cy.visit(routes.patients)
    openRowActionMenu(hospitalNumber)

    cy.get('[data-cy="action-menu"]')
      .contains('button', 'Dashboard')
      .click({ force: true })

    cy.contains('Patient Dashboard', { timeout: 30000 }).should('exist')
    cy.contains(hospitalNumber, { timeout: 20000 }).should('exist')
  })
})
