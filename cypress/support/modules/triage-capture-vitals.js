const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

describe('Triage Capture Vitals', () => {
  it('should open triage actions, capture vitals, fill the form, and save', () => {
    const today = new Date().toISOString().split('T')[0]
    const typeSlowly = (selector, value) => {
      cy.get(selector)
        .should('exist')
        .clear({ force: true })
        .type(value, { force: true, delay: 180 })
      cy.wait(400)
    }

    cy.visit('/login')
    cy.get('input[type="email"]').type(EMAIL, { delay: 120 })
    cy.wait(500)
    cy.get('input[type="password"]').type(PASSWORD, { delay: 120 })
    cy.wait(500)
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')
    cy.wait(3000)

    cy.visit('/ehr/registration')
    cy.get('.MuiDataGrid-row', { timeout: 15000 }).should('have.length.greaterThan', 0)
    cy.wait(1000)

    cy.get('.MuiDataGrid-row')
      .first()
      .find('[data-testid="core-common-action-menu-button"]')
      .click({ force: true })
    cy.wait(1000)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Dashboard', { timeout: 10000 })
      .click({ force: true })
    cy.wait(2500)

    cy.contains('Patient Details Dashboard', { timeout: 15000 }).should('exist')
    cy.wait(1000)

    cy.contains('button', 'Post Patient', { timeout: 15000 }).click({ force: true })
    cy.wait(2500)

    cy.contains('Check in Patient', { timeout: 15000 }).should('exist')

    typeSlowly('input[name="visitDate"]', today)
    typeSlowly('input[name="checkInTime"]', '08:00')
    typeSlowly('input[name="purposeOfVisit"]', 'General Consultation')

    cy.get('select[name="facilityLocationUuid"]', { timeout: 15000 })
      .should('not.be.disabled')
      .then(($sel) => {
        const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
        if (options.length) {
          cy.wrap($sel).select(options[0], { force: true })
        }
      })
    cy.wait(2000)

    cy.get('#services-select').should('exist').click({ force: true })
    cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 10000 })
      .first()
      .click({ force: true })
    cy.wait(1000)

    cy.contains('button', 'Check In', { timeout: 10000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(3000)

    cy.visit('/ehr/triage')
    cy.contains('Triage', { timeout: 15000 }).should('exist')
    cy.contains('Patient in Waiting', { timeout: 15000 }).should('exist')
    cy.wait(1500)

    cy.get('.MuiDataGrid-row', { timeout: 15000 })
      .should('have.length.greaterThan', 0)
    cy.get('.MuiDataGrid-row')
      .first()
      .find('[data-testid="core-common-action-menu-button"]')
      .click({ force: true })
    cy.wait(1000)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Capture Vitals', { timeout: 10000 })
      .click({ force: true })

    cy.contains('Record Triage Details', { timeout: 15000 }).should('exist')
    cy.wait(1500)

    typeSlowly('input[name="vitalSignDate"]', today)

    typeSlowly('input[name="heartRate"]', '72')
    typeSlowly('input[name="respiratoryRate"]', '18')
    typeSlowly('input[name="temperature"]', '36.8')
    typeSlowly('input[name="bloodPressureSystolic"]', '120')
    typeSlowly('input[name="bloodPressureDiastolic"]', '80')
    typeSlowly('input[name="oxygenSaturation"]', '98')
    typeSlowly('input[name="bodyWeight"]', '70')
    typeSlowly('input[name="height"]', '175')

    cy.contains('BMI:', { timeout: 10000 }).should('exist')
    cy.wait(1500)

    cy.contains('button', 'Save', { timeout: 10000 })
      .should('not.be.disabled')
      .click({ force: true })

    cy.contains('Triage', { timeout: 15000 }).should('exist')
    cy.wait(1000)

    cy.contains('button', 'Patient Attended To', { timeout: 15000 }).click({ force: true })
    cy.wait(1500)

    cy.get('.MuiDataGrid-row', { timeout: 15000 })
      .should('have.length.greaterThan', 0)
    cy.get('.MuiDataGrid-row')
      .first()
      .find('[data-testid="core-common-action-menu-button"]')
      .click({ force: true })
    cy.wait(1000)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Dashboard', { timeout: 10000 })
      .click({ force: true })

    cy.contains('Patient Triage Dashboard', { timeout: 15000 }).should('exist')
    cy.wait(1000)
    cy.screenshot('triage-capture-vitals-dashboard')
  })
})