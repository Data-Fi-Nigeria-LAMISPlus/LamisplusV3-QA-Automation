import {
  typeFieldSlowly,
  typeByFieldName,
  selectFirstNativeOption,
  selectAutocompleteOption,
  filterTableByText,
  clickTableRowAction,
  typeByAriaLabel,
  typeDateByLabel,
  selectReactSelectOption,
  selectDropdownOption,
} from '../../../support/pages/opd-consultation.page'

const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

/**
 * Login helper
 */
const loginToApp = () => {
  cy.visit('/login')
  cy.get('input[type="email"]').type(EMAIL, { delay: 120 })
  cy.wait(600)
  cy.get('input[type="password"]').type(PASSWORD, { delay: 120 })
  cy.wait(600)
  cy.get('button[type="submit"]').click()
  cy.url({ timeout: 30000 }).should('not.include', '/login')

  // Try dashboard after login, but do not hard-fail if this user does not land on dashboard.
  cy.location('pathname', { timeout: 30000 }).then((pathname) => {
    if (!pathname.includes('/dashboard')) {
      cy.visit('/dashboard')
    }
  })
}

describe('OPD Consultation - Fill Consultation Form', () => {
  it('should log in successfully', () => {
    loginToApp()
  })

  it.only('should open consultation page, find a patient, use Action menu, fill consultation form, and save', () => {
    loginToApp()

    const today = new Date();
    const yearDate = today.getFullYear().toString();
    const monthDate = String(today.getMonth() + 1).padStart(2, '0');
    const dayDate = String(today.getDate()).padStart(2, '0');
    const uniqueSuffix = `${Date.now()}`
    const hospitalNumber = `HOSP-CY-${uniqueSuffix.slice(-8)}`
    const uniqueEmail = `john.T${uniqueSuffix}@gmail.com`
    const uniqueNin = uniqueSuffix.slice(-4).padStart(4, '0')

    // Navigate to registration
    cy.visit('/patients')
    cy.get('[data-testid="opd-opd-opd-dashboard-btn"]', { timeout: 15000 }).click()
    cy.get('input[name="firstName"]', { timeout: 15000 }).should('exist')

    // Fill basic patient information
    typeDateByLabel('Date of Registration', 'Year', yearDate);
    typeDateByLabel('Date of Registration', 'Day', dayDate);
     typeDateByLabel('Date of Registration', 'Month', monthDate);
    typeFieldSlowly('input[name="hospitalNumber"]', hospitalNumber)
    typeFieldSlowly('input[name="nationalIdentityNumber"]', uniqueNin)
    typeFieldSlowly('input[name="firstName"]', 'John')
    typeFieldSlowly('input[name="middleName"]', 'David')
    typeFieldSlowly('input[name="lastName"]', 'Doe')

    // Select sex
    selectFirstNativeOption('select[name="sex"]')

    // Set date of birth
    typeDateByLabel('Date of Birth', 'Year', '1990');
    typeDateByLabel('Date of Birth', 'Month', monthDate);
    typeDateByLabel('Date of Birth', 'Day', dayDate);

    // Fill registration details
    cy.contains('button', 'Registration Details').click({ force: true })
    selectFirstNativeOption('select[name="maritalStatus"]')
    selectFirstNativeOption('select[name="employmentStatus"]')
    selectFirstNativeOption('select[name="educationLevel"]')

    typeFieldSlowly('input[name="phoneNumber"]', '+2348012345678')
    typeFieldSlowly('input[name="alternativePhoneNumber"]', '+2348087654321')
    typeFieldSlowly('input[name="email"]', uniqueEmail)

    // Select country using autocomplete
    selectReactSelectOption('Select country', 'Nigeria')
    selectDropdownOption(2, 0)
  
    // Select state and LGA
    selectReactSelectOption('Select state', 'Lagos')
    selectDropdownOption(3, 24)
    selectReactSelectOption('Select LGA', 'Lagos Island')
     selectDropdownOption(4, 17)
    typeFieldSlowly('input[name="streetAddress"]', '123 Main Street, Lagos')
    typeFieldSlowly('input[name="landmark"]', 'Near Central Market')

    // Fill next of kin details
    cy.contains('button', 'Next of Kin Details').click({ force: true })
    selectFirstNativeOption('select[name="relationshipType"]')
    typeFieldSlowly('input[name="kinFirstName"]', 'Jane')
    typeFieldSlowly('input[name="kinMiddleName"]', 'Mary')
    typeFieldSlowly('input[name="kinLastName"]', 'Doe')
    typeFieldSlowly('input[name="kinPhoneNumber"]', '+2349012345678')
    typeFieldSlowly('input[name="kinEmail"]', `jane.${uniqueSuffix}@example.com`)
    typeFieldSlowly('input[name="kinAddress"]', '456 Secondary Street, Lagos')

    // Fill emergency contact
    cy.contains('button', 'Emergency Contact').click({ force: true })
    typeFieldSlowly('input[name="emergencyFirstName"]', 'Michael')
    typeFieldSlowly('input[name="emergencyLastName"]', 'Smith')
    typeFieldSlowly('input[name="emergencyPhoneNumber"]', '+2347012345678')
    typeFieldSlowly('input[name="emergencyEmail"]', `michael.${uniqueSuffix}@example.com`)
    selectFirstNativeOption('select[name="emergencyRelationshipType"]')
    typeFieldSlowly('input[name="emergencyAddress"]', '789 Third Avenue, Lagos')

    // Fill billing information
    cy.contains('button', 'Billing Information').click({ force: true })
    selectFirstNativeOption('select[name="billingType"]')
    typeFieldSlowly('input[name="organisationEmployer"]', 'ABC Corporation')

    // Save registration
    cy.contains('button', 'Save', { timeout: 15000 }).click({ force: true })
    cy.wait(4000)

    // Navigate to registration list and access patient dashboard
    cy.visit('/ehr/registration')
    filterTableByText(hospitalNumber)
    clickTableRowAction(/John David Doe/, 'Dashboard')
    cy.wait(2000)

    // Verify patient details dashboard
    // cy.contains('Patient Details Dashboard', { timeout: 15000 }).should('exist')
    
  })
})
    // cy.contains('button', 'Post Patient', { timeout: 15000 }).click({ force: true })
    // cy.wait(2000)

    // cy.contains('Check in Patient', { timeout: 15000 }).should('exist')
    // typeSlowly('input[name="visitDate"]', today)
    // typeSlowly('input[name="checkInTime"]', '08:00')
    // typeSlowly('input[name="purposeOfVisit"]', 'General Consultation')
    // selectFirstNativeOption('select[name="facilityLocationUuid"]')
    // cy.wait(2000)
    // cy.get('#services-select').click({ force: true })
    // selectMUIOptionMatching(/triage/i)
    // cy.contains('button', 'Check In', { timeout: 10000 })
    //   .should('not.be.disabled')
    //   .click({ force: true })
    // cy.wait(2500)

    // cy.visit('/ehr/triage')
    // cy.contains('Triage', { timeout: 15000 }).should('exist')
    // clickGridActionForPatient(hospitalNumber)

    // cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Capture Vitals', { timeout: 10000 })
    //   .click({ force: true })
    // cy.wait(1500)

    // cy.contains('Record Triage Details', { timeout: 15000 }).should('exist')
    // typeSlowly('input[name="vitalSignDate"]', today)
    // typeSlowly('input[name="heartRate"]', '72')
    // typeSlowly('input[name="respiratoryRate"]', '18')
    // typeSlowly('input[name="temperature"]', '36.8')
    // typeSlowly('input[name="bloodPressureSystolic"]', '120')
    // typeSlowly('input[name="bloodPressureDiastolic"]', '80')
    // typeSlowly('input[name="oxygenSaturation"]', '98')
    // typeSlowly('input[name="bodyWeight"]', '70')
    // typeSlowly('input[name="height"]', '175')
    // cy.contains('button', 'Save', { timeout: 10000 })
    //   .should('not.be.disabled')
    //   .click({ force: true })
    // cy.wait(2500)

    // cy.contains('button', 'Patient Attended To', { timeout: 15000 }).click({ force: true })
    // cy.wait(1500)
    // clickGridActionForPatient(hospitalNumber)

    // cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Post Patient', { timeout: 10000 })
    //   .click({ force: true })
    // cy.wait(1500)

    // cy.contains('Check in Patient', { timeout: 15000 }).should('exist')
    // typeSlowly('input[name="visitDate"]', today)
    // typeSlowly('input[name="checkInTime"]', '09:00')
    // typeSlowly('input[name="purposeOfVisit"]', 'Consultation Review')
    // selectFirstNativeOption('select[name="facilityLocationUuid"]')
    // cy.wait(2000)
    // cy.get('#services-select').click({ force: true })
    // selectMUIOptionMatching(/consult/i)
    // cy.contains('button', 'Check In', { timeout: 10000 })
    //   .should('not.be.disabled')
    //   .click({ force: true })
    // cy.wait(2500)

    // fillConsultationForm({ hospitalNumber, today })
