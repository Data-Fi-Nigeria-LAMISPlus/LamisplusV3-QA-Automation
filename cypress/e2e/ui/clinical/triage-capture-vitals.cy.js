import { login } from '../../../support/modules/login'
import {
  captureTriageVitals,
  registerAndPostToTriage,
  routes,
} from '../../../support/modules/opd-consultation-fill-form'

// Capture vitals for a patient waiting in triage, then confirm the save moved
// them onto the Attended tab.
//
// Previously an unreferenced describe() block written against '/ehr/triage' with
// a MUI DataGrid and vitals fields named heartRate / bloodPressureSystolic /
// vitalSignDate. The deployed form is '/opd/triage/record' and its inputs carry
// no usable names - the ids are mangled by their unit suffixes
// (input-temperature-(Â°c)) - so it is driven by placeholder instead.

describe('Triage Capture Vitals', () => {
  beforeEach(() => {
    cy.session('clinical-capture-vitals', () => {
      login()
    })
  })

  it('should capture and save vitals for a patient waiting in triage', () => {
    const hospitalNumber = registerAndPostToTriage()

    // Asserts the POST itself, so a silently dropped save cannot pass.
    captureTriageVitals(hospitalNumber)

    cy.visit(routes.triage)
    cy.contains('button', 'Patient Attended To', { timeout: 30000 }).click({ force: true })
    cy.get('input[placeholder="Search..."]', { timeout: 20000 })
      .clear({ force: true })
      .type(hospitalNumber, { force: true, delay: 60 })

    cy.contains('tbody tr', hospitalNumber, { timeout: 45000 }).should('exist')
  })
})
