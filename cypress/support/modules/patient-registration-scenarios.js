const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

describe('Patient Registration - Additional Scenarios', () => {
  const loginAndOpenRegistration = () => {
    cy.visit('/login')
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')

    cy.visit('/ehr/registration/register')
    cy.get('input[name="firstName"]', { timeout: 15000 }).should('exist')
  }

  const selectAutocompleteOption = (placeholder, optionText) => {
    cy.get(`input[placeholder="${placeholder}"]`, { timeout: 15000 })
      .should('exist')
      .click({ force: true })
      .clear({ force: true })
      .type(optionText, { force: true })

    cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 15000 })
      .contains(new RegExp(optionText, 'i'))
      .click({ force: true })
  }

  it('should display all registration accordion sections', () => {
    loginAndOpenRegistration()

    cy.contains('button', 'Bio Data').should('exist')
    cy.contains('button', 'Registration Details').should('exist')
    cy.contains('button', 'Next of Kin Details').should('exist')
    cy.contains('button', 'Emergency Contact').should('exist')
    cy.contains('button', 'Billing Information').should('exist')
    cy.contains('button', 'Save').should('exist')
  })

  it('should enable state and LGA only after selecting parent location', () => {
    loginAndOpenRegistration()

    cy.contains('button', 'Registration Details').click({ force: true })

    cy.get('input[placeholder="Select state"]', { timeout: 15000 }).should('be.disabled')
    cy.get('input[placeholder="Select LGA"]', { timeout: 15000 }).should('be.disabled')

    selectAutocompleteOption('Select country', 'Nigeria')
    cy.wait(1500)
    cy.get('input[placeholder="Select state"]', { timeout: 15000 }).should('not.be.disabled')

    selectAutocompleteOption('Select state', 'Lagos')
    cy.wait(1500)
    cy.get('input[placeholder="Select LGA"]', { timeout: 15000 }).should('not.be.disabled')
  })

  it('should copy patient contact details when same-as-patient is checked', () => {
    loginAndOpenRegistration()

    // Fill patient details used by emergency same-as-patient sync
    cy.get('input[name="firstName"]').type('John', { force: true })
    cy.get('input[name="lastName"]').type('Doe', { force: true })

    cy.contains('button', 'Registration Details').click({ force: true })
    cy.get('input[name="phoneNumber"]').clear({ force: true }).type('+2348012345678', { force: true })
    cy.get('input[name="email"]').type('john.doe@example.com', { force: true })
    cy.get('input[name="streetAddress"]').type('123 Main Street, Lagos', { force: true })

    cy.contains('button', 'Emergency Contact').click({ force: true })
    cy.contains('label', "Same as patient's contact information")
      .find('input[type="checkbox"]')
      .check({ force: true })

    cy.get('input[name="emergencyFirstName"]').should('have.value', 'John')
    cy.get('input[name="emergencyLastName"]').should('have.value', 'Doe')
    cy.get('input[name="emergencyEmail"]').should('have.value', 'john.doe@example.com')
    cy.get('input[name="emergencyAddress"]').should('have.value', '123 Main Street, Lagos')
    cy.get('input[name="emergencyPhoneNumber"]').invoke('val').should('match', /\+?\d{6,}/)
  })
})
