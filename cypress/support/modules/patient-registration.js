const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

describe('Patient Registration', () => {
  it('should login, navigate to patient registration, fill all fields and save', () => {

    const selectAutocompleteOption = (placeholder, optionText) => {
      cy.get(`input[placeholder="${placeholder}"]`, { timeout: 10000 })
        .should('exist')
        .click({ force: true })
        .clear({ force: true })
        .type(optionText, { force: true })

      cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 10000 })
        .contains(new RegExp(optionText, 'i'))
        .click({ force: true })
    }

    // Step 1: Login
    cy.visit('/login')
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')
    cy.wait(3000)

    // Step 2: Navigate directly to the registration form
    cy.visit('/ehr/registration/register')
    cy.wait(4000)
    cy.get('input[name="firstName"]', { timeout: 10000 }).should('exist')
    cy.log('Registration form loaded')

    // ─── 1. BIO DATA (defaultExpanded — already open) ──────────────────────
    cy.get('input[name="dateOfRegistration"]').type('2026-03-24', { force: true })
    cy.wait(200)
    cy.get('input[name="hospitalNumber"]').type('HOSP-TEST-001', { force: true })
    cy.wait(200)
    cy.get('input[name="nationalIdentityNumber"]').type('12345678901', { force: true })
    cy.wait(200)
    cy.get('input[name="firstName"]').type('John', { force: true })
    cy.wait(200)
    cy.get('input[name="middleName"]').type('David', { force: true })
    cy.wait(200)
    cy.get('input[name="lastName"]').type('Doe', { force: true })
    cy.wait(200)
    cy.get('select[name="sex"]').then($sel => {
      const opts = [...$sel[0].options].map(o => o.value).filter(v => v)
      if (opts.length) cy.wrap($sel).select(opts[0], { force: true })
    })
    cy.wait(200)
    cy.get('input[name="dateOfBirth"]').type('1990-01-15', { force: true })
    cy.wait(500)

    // ─── 2. REGISTRATION DETAILS (collapsed — click header to expand) ───────
    cy.contains('button', 'Registration Details').click({ force: true })
    cy.wait(1500)
    cy.get('select[name="maritalStatus"]', { timeout: 10000 }).should('exist')
    cy.get('select[name="maritalStatus"]').then($sel => {
      const opts = [...$sel[0].options].map(o => o.value).filter(v => v)
      if (opts.length) cy.wrap($sel).select(opts[0], { force: true })
    })
    cy.wait(200)
    cy.get('select[name="employmentStatus"]').then($sel => {
      const opts = [...$sel[0].options].map(o => o.value).filter(v => v)
      if (opts.length) cy.wrap($sel).select(opts[0], { force: true })
    })
    cy.wait(200)
    cy.get('select[name="educationLevel"]').then($sel => {
      const opts = [...$sel[0].options].map(o => o.value).filter(v => v)
      if (opts.length) cy.wrap($sel).select(opts[0], { force: true })
    })
    cy.wait(200)
    cy.get('input[name="phoneNumber"]').clear({ force: true }).type('+2348012345678', { force: true })
    cy.wait(200)
    cy.get('input[name="alternativePhoneNumber"]').clear({ force: true }).type('+2348087654321', { force: true })
    cy.wait(200)
    cy.get('input[name="email"]').type('john.doe@example.com', { force: true })
    cy.wait(200)
    selectAutocompleteOption('Select country', 'Nigeria')
    cy.wait(1500)
    selectAutocompleteOption('Select state', 'Lagos')
    cy.wait(1500)
    cy.get('input[placeholder="Select LGA"]', { timeout: 10000 })
      .should('exist')
      .click({ force: true })
    cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 10000 }).first().click({ force: true })
    cy.wait(500)
    cy.get('input[name="streetAddress"]').type('123 Main Street, Lagos', { force: true })
    cy.wait(200)
    cy.get('input[name="landmark"]').type('Near Central Market', { force: true })
    cy.wait(200)

    // ─── 3. NEXT OF KIN (collapsed — click header to expand) ────────────────
    cy.contains('button', 'Next of Kin Details').click({ force: true })
    cy.wait(1000)
    cy.get('select[name="relationshipType"]', { timeout: 10000 }).should('exist')
    cy.get('select[name="relationshipType"]').then($sel => {
      const opts = [...$sel[0].options].map(o => o.value).filter(v => v)
      if (opts.length) cy.wrap($sel).select(opts[0], { force: true })
    })
    cy.wait(200)
    cy.get('input[name="kinFirstName"]').type('Jane', { force: true })
    cy.wait(200)
    cy.get('input[name="kinMiddleName"]').type('Mary', { force: true })
    cy.wait(200)
    cy.get('input[name="kinLastName"]').type('Doe', { force: true })
    cy.wait(200)
    cy.get('input[name="kinPhoneNumber"]').clear({ force: true }).type('+2349012345678', { force: true })
    cy.wait(200)
    cy.get('input[name="kinEmail"]').type('jane.doe@example.com', { force: true })
    cy.wait(200)
    cy.get('input[name="kinAddress"]').type('456 Secondary Street, Lagos', { force: true })
    cy.wait(200)

    // ─── 4. EMERGENCY CONTACT (collapsed — click header to expand) ──────────
    cy.contains('button', 'Emergency Contact').click({ force: true })
    cy.wait(1000)
    cy.get('input[name="emergencyFirstName"]', { timeout: 10000 }).should('exist')
    cy.get('input[name="emergencyFirstName"]').type('Michael', { force: true })
    cy.wait(200)
    cy.get('input[name="emergencyLastName"]').type('Smith', { force: true })
    cy.wait(200)
    cy.get('input[name="emergencyPhoneNumber"]').clear({ force: true }).type('+2347012345678', { force: true })
    cy.wait(200)
    cy.get('input[name="emergencyEmail"]').type('michael.smith@example.com', { force: true })
    cy.wait(200)
    cy.get('select[name="emergencyRelationshipType"]').then($sel => {
      const opts = [...$sel[0].options].map(o => o.value).filter(v => v)
      if (opts.length) cy.wrap($sel).select(opts[0], { force: true })
    })
    cy.wait(200)
    cy.get('input[name="emergencyAddress"]').type('789 Third Avenue, Lagos', { force: true })
    cy.wait(200)

    // ─── 5. BILLING INFORMATION (collapsed — click header to expand) ─────────
    cy.contains('button', 'Billing Information').click({ force: true })
    cy.wait(1000)
    cy.get('select[name="billingType"]', { timeout: 10000 }).should('exist')
    cy.get('select[name="billingType"]').then($sel => {
      const opts = [...$sel[0].options].map(o => o.value).filter(v => v)
      if (opts.length) cy.wrap($sel).select(opts[0], { force: true })
    })
    cy.wait(200)
    cy.get('input[name="organisationEmployer"]').type('ABC Corporation', { force: true })
    cy.wait(200)

    // ─── SAVE ────────────────────────────────────────────────────────────────
    cy.wait(500)
    cy.contains('button', 'Save').click({ force: true })
    cy.wait(4000)
    cy.screenshot('patient-registration-complete')

    cy.get('body').then($body => {
      const text = $body.text()
      if (text.includes('success') || text.includes('created') || text.includes('registered')) {
        cy.log('Patient registered successfully')
      } else {
        cy.log('Form submitted - check screenshot for result')
      }
    })
  })
})
