import { login } from '../../../support/modules/login'
import { patientRegistration } from '../../../support/modules/patient-flow'
import {
  checkInPatient,
  openPatientDashboard,
} from '../../../support/modules/opd-consultation-fill-form'

// Checking a patient in - opening a facility visit.
//
// Distinct from Post Patient, which routes an already-checked-in patient to a
// service point: Check In only opens the visit, and the observable result is the
// header button flipping to "Check Out".
//
// Each test registers its own patient, because a patient who already has an open
// visit shows "Check Out" and there is nothing left to check in.

describe('Patient check-in', () => {
  beforeEach(() => {
    cy.session('patient-checkin', () => {
      login()
    })
  })

  it('should show the check-in dialog with its required fields', () => {
    const hospitalNumber = patientRegistration()
    openPatientDashboard(hospitalNumber)

    cy.contains('button', 'Check In', { timeout: 20000 }).click({ force: true })
    cy.contains('Check In Patient', { timeout: 20000 }).should('exist')

    // Date and time arrive prefilled; the rest are required.
    cy.contains('label', /Check In Type/i).should('exist')
    cy.contains('label', /Checked In By/i).should('exist')
    cy.contains('label', /Comments/i).should('exist')
    cy.contains('button', 'Cancel').should('exist')
  })

  it('should offer both consultation types on check-in', () => {
    const hospitalNumber = patientRegistration()
    openPatientDashboard(hospitalNumber)

    cy.contains('button', 'Check In', { timeout: 20000 }).click({ force: true })
    cy.contains('Check In Patient', { timeout: 20000 }).should('exist')

    cy.get('[id="select-check-in-type-*"]', { timeout: 20000 }).then(($select) => {
      const options = [...$select[0].options].map((option) => option.text.trim())
      expect(options).to.include.members(['New Consultation', 'Follow-up Consultation'])
    })
  })

  it('should check a newly registered patient in', () => {
    const hospitalNumber = patientRegistration()
    openPatientDashboard(hospitalNumber)

    // A fresh patient has no open visit, so Check In is the offered action.
    cy.contains('button', 'Check In', { timeout: 20000 }).should('exist')

    checkInPatient()

    // The visit is open once the action flips to Check Out.
    cy.contains('button', 'Check Out', { timeout: 30000 }).should('exist')
    cy.contains(hospitalNumber).should('exist')
  })

  it('should leave the patient unchecked-in on Cancel', () => {
    const hospitalNumber = patientRegistration()
    openPatientDashboard(hospitalNumber)

    cy.contains('button', 'Check In', { timeout: 20000 }).click({ force: true })
    cy.contains('Check In Patient', { timeout: 20000 }).should('exist')
    cy.contains('button', 'Cancel').click({ force: true })
    cy.wait(2500)

    cy.contains('Check In Patient').should('not.exist')
    cy.contains('button', 'Check In').should('exist')
  })
})
