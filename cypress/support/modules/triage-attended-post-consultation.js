const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

describe('Triage Attended - Post Patient to Consultation', () => {
  it('should open attended tab action menu and post a patient to consultation', () => {
    const today = new Date().toISOString().split('T')[0]
    const typingDelay = 220
    const shortPause = 700
    const mediumPause = 1200
    const longPause = 1800

    const typeSlowly = (selector, value) => {
      cy.get(selector)
        .should('exist')
        .clear({ force: true })
        .type(value, { force: true, delay: typingDelay })
      cy.wait(shortPause)
    }

    const selectFirstOption = (selector) => {
      cy.get(selector, { timeout: 15000 })
        .should('not.be.disabled')
        .then(($sel) => {
          const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
          if (options.length) {
            cy.wrap($sel).select(options[0], { force: true })
          }
        })
    }

    cy.visit('/login')
    cy.get('input[type="email"]').type(EMAIL, { delay: 150 })
    cy.wait(shortPause)
    cy.get('input[type="password"]').type(PASSWORD, { delay: 150 })
    cy.wait(shortPause)
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')
    cy.wait(longPause)

    // Ensure there is a patient in triage by posting one from registration and capturing vitals.
    cy.visit('/ehr/registration')
    cy.get('.MuiDataGrid-row', { timeout: 15000 }).should('have.length.greaterThan', 0)

    cy.get('.MuiDataGrid-row')
      .first()
      .find('[data-testid="core-common-action-menu-button"]')
      .click({ force: true })
    cy.wait(mediumPause)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Dashboard', { timeout: 10000 })
      .click({ force: true })
    cy.wait(mediumPause)

    cy.contains('Patient Details Dashboard', { timeout: 15000 }).should('exist')
    cy.wait(shortPause)
    cy.contains('button', 'Post Patient', { timeout: 15000 }).click({ force: true })
    cy.wait(mediumPause)

    cy.contains('Check in Patient', { timeout: 15000 }).should('exist')
    typeSlowly('input[name="visitDate"]', today)
    typeSlowly('input[name="checkInTime"]', '08:15')
    typeSlowly('input[name="purposeOfVisit"]', 'General Consultation')
    selectFirstOption('select[name="facilityLocationUuid"]')
    cy.wait(longPause)

    cy.get('#services-select').should('exist').click({ force: true })
    cy.wait(shortPause)
    cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 10000 })
      .first()
      .click({ force: true })
    cy.wait(shortPause)

    cy.contains('button', 'Check In', { timeout: 10000 }).click({ force: true })
    cy.wait(longPause)

    // Capture vitals so the patient appears under Attended.
    cy.visit('/ehr/triage')
    cy.contains('Triage', { timeout: 15000 }).should('exist')
    cy.get('.MuiDataGrid-row', { timeout: 15000 }).should('have.length.greaterThan', 0)

    cy.get('.MuiDataGrid-row')
      .first()
      .find('[data-testid="core-common-action-menu-button"]')
      .click({ force: true })
    cy.wait(mediumPause)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Capture Vitals', { timeout: 10000 })
      .click({ force: true })
    cy.wait(mediumPause)

    cy.contains('Record Triage Details', { timeout: 15000 }).should('exist')

    typeSlowly('input[name="vitalSignDate"]', today)
    typeSlowly('input[name="heartRate"]', '74')
    typeSlowly('input[name="respiratoryRate"]', '18')
    typeSlowly('input[name="temperature"]', '36.9')
    typeSlowly('input[name="bloodPressureSystolic"]', '118')
    typeSlowly('input[name="bloodPressureDiastolic"]', '78')
    typeSlowly('input[name="oxygenSaturation"]', '98')
    typeSlowly('input[name="bodyWeight"]', '71')
    typeSlowly('input[name="height"]', '176')
    cy.wait(shortPause)

    cy.contains('button', 'Save', { timeout: 10000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(longPause)

    // Requested flow: go to Attended tab, Actions, and Post Patient to consultation.
    cy.contains('button', 'Patient Attended To', { timeout: 15000 }).click({ force: true })
    cy.wait(mediumPause)
    cy.get('.MuiDataGrid-row', { timeout: 15000 }).should('have.length.greaterThan', 0)

    cy.get('.MuiDataGrid-row')
      .first()
      .find('[data-testid="core-common-action-menu-button"]')
      .click({ force: true })
    cy.wait(mediumPause)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Post Patient', { timeout: 10000 })
      .click({ force: true })
    cy.wait(mediumPause)

    cy.contains('Check in Patient', { timeout: 15000 }).should('exist')

    typeSlowly('input[name="visitDate"]', today)
    typeSlowly('input[name="checkInTime"]', '09:00')
    typeSlowly('input[name="purposeOfVisit"]', 'Consultation Review')

    selectFirstOption('select[name="facilityLocationUuid"]')
    cy.wait(longPause)

    cy.get('#services-select').should('exist').click({ force: true })
    cy.wait(shortPause)
    cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 10000 }).then(($options) => {
      const consultationOption = [...$options].find((option) => /consult/i.test(option.innerText))
      if (consultationOption) {
        cy.wrap(consultationOption).click({ force: true })
      } else {
        cy.wrap($options[0]).click({ force: true })
      }
    })

    cy.contains('button', 'Check In', { timeout: 10000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(longPause)

    cy.contains('Triage', { timeout: 15000 }).should('exist')
    cy.screenshot('attended-post-patient-to-consultation')
  })
})
