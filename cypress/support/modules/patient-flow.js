export const locator = {
  EMAIL_INPUT: 'input[name="email"]',
  FIRST_NAME_INPUT: 'input[name="firstName"]',
  MIDDLE_NAME_INPUT: 'input[name="middleName"]',
  LAST_NAME_INPUT: 'input[name="lastName"]',
  // BioDataSection renders Sex through the shared Select, which emits a native
  // <select name="sex">. This key was referenced below but never defined.
  SEX_SELECT: 'select[name="sex"]',
  DOB_ESTIMATED_RADIO: '[data-cy="patient-dob-estimated"]',
  AGE_INPUT: 'input[name="age"]',
  AGE_UNIT_SELECT: 'select[name="ageUnit"]',
  DATE_OF_BIRTH_INPUT: 'input[name="dateOfBirth"]',
  DATE_OF_REGISTRATION_INPUT: 'input[name="dateOfRegistration"]',
  HOSPITAL_NUMBER_INPUT: 'input[name="hospitalNumber"]',
  NATIONAL_ID_INPUT: 'input[name="nationalIdentityNumber"]',
  AUTOCOMPLETE_COUNTRY: 'input[placeholder="Select country"]',
  AUTOCOMPLETE_STATE: 'input[placeholder="Select state"]',
  AUTOCOMPLETE_LGA: 'input[placeholder="Select LGA"]',
  STREET_ADDRESS_INPUT: 'input[name="streetAddress"]',
  LANDMARK_INPUT: 'input[name="landmark"]',
  PHONE_NUMBER_INPUT: 'input[name="phoneNumber"]',
  ALTERNATIVE_PHONE_NUMBER_INPUT: 'input[name="alternativePhoneNumber"]',
  EMAIL_INPUT: 'input[name="email"]',
  RELATIONSHIP_TYPE_SELECT: 'select[name="relationshipType"]',
    KIN_PHONE_NUMBER_INPUT: 'input[name="kinPhoneNumber"]',
    KIN_EMAIL_INPUT: 'input[name="kinEmail"]',
    KIN_ADDRESS_INPUT: 'input[name="kinAddress"]',
    EMERGENCY_FIRST_NAME_INPUT: 'input[name="emergencyFirstName"]',
    EMERGENCY_LAST_NAME_INPUT: 'input[name="emergencyLastName"]',
    EMERGENCY_PHONE_NUMBER_INPUT: 'input[name="emergencyPhoneNumber"]',
    EMERGENCY_EMAIL_INPUT: 'input[name="emergencyEmail"]',
    EMERGENCY_RELATIONSHIP_TYPE_SELECT: 'select[name="emergencyRelationshipType"]',
    EMERGENCY_ADDRESS_INPUT: 'input[name="emergencyAddress"]',
    AUTOCOMPLETE_BILLING_TYPE: 'select[name="billingType"]',
    INPUT_ORGANISATION_EMPLOYER: 'input[name="organisationEmployer"]',
    AUTOCOMPLETE_MARITAL_STATUS: 'select[name="maritalStatus"]',
    AUTOCOMPLETE_EMPLOYMENT_STATUS: 'select[name="employmentStatus"]',
    AUTOCOMPLETE_EDUCATION_LEVEL: 'select[name="educationLevel"]',
    AUTOCOMPLETE_POPUP_OPTIONS: '.MuiAutocomplete-popper [role="option"]',
    BILLING_TYPE_SELECT: 'select[name="billingType"]',
    ORGANISATION_EMPLOYER_INPUT: 'input[name="organisationEmployer"]',
    EMERGENCY_ADDRESS_INPUT: 'input[name="emergencyAddress"]',
    EMERGENCY_EMAIL_INPUT: 'input[name="emergencyEmail"]',
    EMERGENCY_PHONE_NUMBER_INPUT: 'input[name="emergencyPhoneNumber"]',
    EMERGENCY_LAST_NAME_INPUT: 'input[name="emergencyLastName"]',
    EMERGENCY_FIRST_NAME_INPUT: 'input[name="emergencyFirstName"]',
    EMERGENCY_RELATIONSHIP_TYPE_SELECT: 'select[name="emergencyRelationshipType"]',
    KIN_ADDRESS_INPUT: 'input[name="kinAddress"]',
    KIN_EMAIL_INPUT: 'input[name="kinEmail"]',
    KIN_PHONE_NUMBER_INPUT: 'input[name="kinPhoneNumber"]',
    KIN_LAST_NAME_INPUT: 'input[name="kinLastName"]',
    KIN_MIDDLE_NAME_INPUT: 'input[name="kinMiddleName"]',
    KIN_FIRST_NAME_INPUT: 'input[name="kinFirstName"]',
    RELATIONSHIP_TYPE_SELECT: 'select[name="relationshipType"]',
    LGA_OPTION: '.MuiAutocomplete-popper [role="option"]',
    LGA_INPUT: 'input[placeholder="Select LGA"]',
    EDUCATION_LEVEL_SELECT: 'select[name="educationLevel"]',
    EMPLOYMENT_STATUS_SELECT: 'select[name="employmentStatus"]',
    MARITAL_STATUS_SELECT: 'select[name="maritalStatus"]',

}
// The deployed form uses react-select (classNamePrefix "ss"), not MUI Autocomplete,
// so options live in .ss__option rather than .MuiAutocomplete-popper. The three
// location pickers are the only comboboxes on the form, in DOM order:
// 0 = Country, 1 = State, 2 = Province/District/LGA.
export const selectLocationCombobox = (index, optionText) => {
  cy.get('input[role="combobox"]', { timeout: 15000 })
    .eq(index)
    .should('not.be.disabled')
    .click({ force: true })
    .type(optionText, { force: true })

  cy.get('.ss__option', { timeout: 15000 })
    .contains(new RegExp(optionText, 'i'))
    .click({ force: true })
}

// Date of Registration / Date of Birth are MUI pickers rendered read-only
// (aria-readonly on every section, readonly on the hidden input), so the value
// cannot be typed - it has to come from the calendar popup.
export const pickDateFromCalendar = (index) => {
  cy.get('button[aria-label*="Choose date"]', { timeout: 15000 }).eq(index).click({ force: true })
  cy.get('[role="dialog"]', { timeout: 15000 }).should('be.visible')
  cy.get('[role="dialog"]').then(($dialog) => {
    const today = $dialog.find('button[aria-current="date"]:not([disabled])')
    if (today.length) {
      cy.wrap(today.first()).click({ force: true })
    } else {
      cy.wrap($dialog).find('button:not([disabled])[role="gridcell"]').first().click({ force: true })
    }
  })
  cy.get('[role="dialog"]').should('not.exist')
}

export const selectFirstRealOption = (selector) => {
  cy.get(selector, { timeout: 15000 }).then(($sel) => {
    const options = [...$sel[0].options].map((o) => o.value).filter(Boolean)
    if (options.length) cy.wrap($sel).select(options[0], { force: true })
  })
}

export const patientRegistration = () => {
    // '/ehr/registration/register' 404s on the deployed app; the live route is
    // '/patients/register'.
    cy.visit('/patients/register')
    cy.get(locator.FIRST_NAME_INPUT, { timeout: 30000 }).should('exist')

    // Unique per run so repeat runs cannot collide on hospital number / NIN.
    const suffix = `${Date.now()}`
    const hospitalNumber = `HOSP-CY-${suffix.slice(-8)}`
    const nin = suffix.slice(-11).padStart(11, '0')

    // ─── 1. BIO DATA (expanded by default) ──────────────────────────────────
    pickDateFromCalendar(0) // Date of Registration -> today
    cy.get(locator.HOSPITAL_NUMBER_INPUT).clear({ force: true }).type(hospitalNumber, { force: true })
    cy.get(locator.NATIONAL_ID_INPUT).clear({ force: true }).type(nin, { force: true })
    cy.get(locator.FIRST_NAME_INPUT).clear({ force: true }).type('John', { force: true })
    cy.get(locator.MIDDLE_NAME_INPUT).clear({ force: true }).type('David', { force: true })
    cy.get(locator.LAST_NAME_INPUT).clear({ force: true }).type('Doe', { force: true })
    selectFirstRealOption(locator.SEX_SELECT)

    // Date of Birth: switch the type to "Estimated" and supply an age instead of
    // driving the second calendar. The calendar disables future months, so it can
    // only land on today, which the API rejects (age 0 days) as a business-rule
    // violation. The control is a custom radio - the click target is the div
    // carrying data-cy, not the adjacent label text.
    cy.get(locator.DOB_ESTIMATED_RADIO).click({ force: true })
    cy.get(locator.AGE_INPUT, { timeout: 15000 }).clear({ force: true }).type('35', { force: true })
    cy.get(locator.AGE_UNIT_SELECT).select('Years', { force: true })

    // ─── 2. REGISTRATION DETAILS ────────────────────────────────────────────
    cy.contains('button', 'Registration Details').click({ force: true })
    cy.get(locator.MARITAL_STATUS_SELECT, { timeout: 15000 }).should('exist')
    selectFirstRealOption(locator.MARITAL_STATUS_SELECT)
    selectFirstRealOption(locator.EMPLOYMENT_STATUS_SELECT)
    selectFirstRealOption(locator.EDUCATION_LEVEL_SELECT)
    cy.get(locator.PHONE_NUMBER_INPUT).clear({ force: true }).type('08012345678', { force: true })
    cy.get(locator.ALTERNATIVE_PHONE_NUMBER_INPUT).clear({ force: true }).type('08087654321', { force: true })
    cy.get(locator.EMAIL_INPUT).clear({ force: true }).type(`john.${suffix}@example.com`, { force: true })

    // Country -> State -> LGA cascade; each unlocks the next.
    selectLocationCombobox(0, 'Nigeria')
    selectLocationCombobox(1, 'Lagos')
    cy.get('input[role="combobox"]').eq(2).should('not.be.disabled').click({ force: true })
    cy.get('.ss__option', { timeout: 15000 }).first().click({ force: true })

    cy.get(locator.STREET_ADDRESS_INPUT).clear({ force: true }).type('123 Main Street, Lagos', { force: true })
    cy.get(locator.LANDMARK_INPUT).clear({ force: true }).type('Near Central Market', { force: true })

    // ─── 3. NEXT OF KIN ─────────────────────────────────────────────────────
    cy.contains('button', 'Next of Kin Details').click({ force: true })
    cy.get(locator.RELATIONSHIP_TYPE_SELECT, { timeout: 15000 }).should('exist')
    selectFirstRealOption(locator.RELATIONSHIP_TYPE_SELECT)
    cy.get(locator.KIN_FIRST_NAME_INPUT).clear({ force: true }).type('Jane', { force: true })
    cy.get(locator.KIN_MIDDLE_NAME_INPUT).clear({ force: true }).type('Mary', { force: true })
    cy.get(locator.KIN_LAST_NAME_INPUT).clear({ force: true }).type('Doe', { force: true })
    cy.get(locator.KIN_PHONE_NUMBER_INPUT).clear({ force: true }).type('09012345678', { force: true })
    cy.get(locator.KIN_EMAIL_INPUT).clear({ force: true }).type(`jane.${suffix}@example.com`, { force: true })
    cy.get(locator.KIN_ADDRESS_INPUT).clear({ force: true }).type('456 Secondary Street, Lagos', { force: true })

    // ─── 4. EMERGENCY CONTACT ───────────────────────────────────────────────
    cy.contains('button', 'Emergency Contact').click({ force: true })
    cy.get(locator.EMERGENCY_FIRST_NAME_INPUT, { timeout: 15000 }).should('exist')
    cy.get(locator.EMERGENCY_FIRST_NAME_INPUT).clear({ force: true }).type('Michael', { force: true })
    cy.get(locator.EMERGENCY_LAST_NAME_INPUT).clear({ force: true }).type('Smith', { force: true })
    cy.get(locator.EMERGENCY_PHONE_NUMBER_INPUT).clear({ force: true }).type('07012345678', { force: true })
    cy.get(locator.EMERGENCY_EMAIL_INPUT).clear({ force: true }).type(`michael.${suffix}@example.com`, { force: true })
    selectFirstRealOption(locator.EMERGENCY_RELATIONSHIP_TYPE_SELECT)
    cy.get(locator.EMERGENCY_ADDRESS_INPUT).clear({ force: true }).type('789 Third Avenue, Lagos', { force: true })

    // ─── 5. BILLING INFORMATION ─────────────────────────────────────────────
    cy.contains('button', 'Billing Information').click({ force: true })
    cy.get(locator.BILLING_TYPE_SELECT, { timeout: 15000 }).should('exist')
    selectFirstRealOption(locator.BILLING_TYPE_SELECT)
    cy.get(locator.ORGANISATION_EMPLOYER_INPUT).clear({ force: true }).type('ABC Corporation', { force: true })

    // ─── SAVE ───────────────────────────────────────────────────────────────
    cy.intercept('POST', '**/patient**').as('createPatient')
    cy.contains('button', 'Save').click({ force: true })

    // Assert the patient was actually created rather than just screenshotting.
    // The server's validation payload is folded into the assertion message so a
    // rejection names the offending field instead of just a status code.
    cy.wait('@createPatient', { timeout: 30000 }).then(({ request, response }) => {
      const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
      const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
      expect(
        response?.statusCode,
        `create patient rejected.\nresponse: ${body}\nrequest: ${sent}`
      ).to.be.oneOf([200, 201])
    })
  };

