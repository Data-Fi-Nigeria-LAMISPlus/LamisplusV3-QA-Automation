import { login } from '../../../support/modules/login'
import { patientRegistration } from '../../../support/modules/patient-flow'
import {
  captureTriageVitals,
  checkInPatient,
  fillConsultationForm,
  openPatientDashboard,
  postPatientToServicePoint,
} from '../../../support/modules/opd-consultation-fill-form'

// End-to-end OPD path on the deployed QA build:
//   register -> check in -> post to Triage -> capture vitals
//           -> post to Consultation -> open the consultation form
//
// This spec previously re-implemented patient registration inline (~110 lines)
// against the '/ehr/*' routes and data-testid selectors from the app source.
// Neither exists on the deployment, so it failed at the first navigation. It now
// reuses the same registration module the smoke suite exercises, and drives the
// deployed UI - see opd-consultation-fill-form.js for the route/selector map.

describe('OPD Consultation - Fill Consultation Form', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    login()
  })

  it('should log in successfully', () => {
    cy.url().should('not.include', '/login')
  })

  it('should register a patient, post through triage, and save the consultation form', () => {
    const hospitalNumber = patientRegistration()

    openPatientDashboard(hospitalNumber)
    checkInPatient()
    postPatientToServicePoint(/triage/i)

    captureTriageVitals(hospitalNumber)

    openPatientDashboard(hospitalNumber)
    postPatientToServicePoint(/consult/i)

    fillConsultationForm({ hospitalNumber })
  })
})
