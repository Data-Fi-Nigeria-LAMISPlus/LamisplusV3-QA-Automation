import { login } from '../../../support/modules/login'
import {
  checkInPatient,
  openPatientDashboard,
  postPatientToServicePoint,
  routes,
} from '../../../support/modules/opd-consultation-fill-form'
import { patientRegistration } from '../../../support/modules/patient-flow'

// Registration -> patient dashboard -> check in -> post to the Triage service
// point, verified by the patient turning up on the triage worklist.
//
// Previously an unreferenced describe() block written against '/ehr/registration'
// with a MUI DataGrid and a check-in form of visitDate / checkInTime /
// purposeOfVisit / facilityLocationUuid / #services-select. None of that is on
// the deployed build: the list is '/patients', and "Check In" (open a visit) and
// "Post Patient" (route to a service point) are two separate dialogs.

describe('Post Patient to Triage', () => {
  beforeEach(() => {
    cy.session('clinical-post-triage', () => {
      login()
    })
  })

  it('should check a patient in and post them to the triage worklist', () => {
    const hospitalNumber = patientRegistration()

    openPatientDashboard(hospitalNumber)
    checkInPatient()
    postPatientToServicePoint(/triage/i)

    // The posting is only real if the patient is now queued in triage.
    cy.visit(routes.triage)
    cy.contains('Triage', { timeout: 30000 }).should('exist')
    cy.get('input[placeholder="Search..."]', { timeout: 20000 })
      .clear({ force: true })
      .type(hospitalNumber, { force: true, delay: 60 })

    cy.contains('tbody tr', hospitalNumber, { timeout: 45000 })
      .should('contain', 'TRIAGE')
  })
})
