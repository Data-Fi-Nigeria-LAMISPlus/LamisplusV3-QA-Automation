import { login } from '../../../support/modules/login'
import {
  captureTriageVitals,
  clickActionMenuItem,
  fillPostPatientDialog,
  openRowActionMenu,
  registerAndPostToTriage,
  routes,
} from '../../../support/modules/opd-consultation-fill-form'

// The Attended-tab route onward: once vitals are captured, the patient is posted
// to Consultation from the triage Attended tab rather than from their dashboard.
//
// Previously an unreferenced describe() block against '/ehr/triage' + MUI
// DataGrid. On the deployed build the Attended tab's row menu offers
// "Post Patient" / "Dashboard", and Post Patient opens the same dialog the
// patient dashboard uses - hence the shared fillPostPatientDialog.

describe('Triage Attended - Post Patient to Consultation', () => {
  beforeEach(() => {
    cy.session('clinical-attended-post-consultation', () => {
      login()
    })
  })

  it('should post an attended patient to consultation from the Attended tab', () => {
    const hospitalNumber = registerAndPostToTriage()
    captureTriageVitals(hospitalNumber)

    cy.visit(routes.triage)
    cy.contains('button', 'Patient Attended To', { timeout: 30000 }).click({ force: true })
    cy.wait(1500)

    openRowActionMenu(hospitalNumber)
    clickActionMenuItem('Post Patient')
    fillPostPatientDialog(/consult/i)

    // Confirm the patient actually reached the consultation worklist.
    cy.visit(routes.consultation)
    cy.contains('Consultation', { timeout: 30000 }).should('exist')
    cy.get('input[placeholder="Search..."]', { timeout: 20000 })
      .clear({ force: true })
      .type(hospitalNumber, { force: true, delay: 60 })

    cy.contains('tbody tr', hospitalNumber, { timeout: 45000 }).should('exist')
  })
})
