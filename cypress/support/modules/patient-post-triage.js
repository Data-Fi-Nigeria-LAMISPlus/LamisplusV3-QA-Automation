const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

describe('Post Patient to Triage', () => {
  it('should open Action menu for a patient, navigate to Dashboard, click Post Patient and submit check-in form', () => {
    // Generate today's date in YYYY-MM-DD format (visit date must be today or future)
    const today = new Date().toISOString().split('T')[0]

    // ─── Step 1: Login ────────────────────────────────────────────────────────
    cy.visit('/login')
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')
    cy.wait(3000)

    // ─── Step 2: Navigate to patient registration list ────────────────────────
    cy.visit('/ehr/registration')
    cy.wait(3000)

    // Wait for at least one patient row to appear in the DataGrid
    cy.get('.MuiDataGrid-row', { timeout: 15000 }).should('have.length.greaterThan', 0)
    cy.log('Patient list loaded')

    // ─── Step 3: Open the Action menu for the first patient row ───────────────
    // The ActionMenu trigger button has data-testid="core-common-action-menu-button"
    // stopPropagation prevents the row click from navigating away
    cy.get('.MuiDataGrid-row')
      .first()
      .find('[data-testid="core-common-action-menu-button"]')
      .click({ force: true })
    cy.wait(500)

    // ─── Step 4: Click "Dashboard" from the action menu ───────────────────────
    // Menu items are rendered via portal on document.body with data-testid="core-common-action-menu-button-1"
    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Dashboard')
      .click({ force: true })
    cy.wait(3000)

    // ─── Step 5: Verify Patient Details page has loaded ───────────────────────
    cy.contains('Patient Details Dashboard', { timeout: 15000 }).should('exist')
    cy.log('Patient Details page loaded')

    // ─── Step 6: Click "Post Patient" button ──────────────────────────────────
    // Navigates to /ehr/:id/check-in
    cy.contains('button', 'Post Patient', { timeout: 15000 }).click({ force: true })
    cy.wait(3000)

    // ─── Step 7: Verify Check In form has loaded ──────────────────────────────
    cy.contains('Check in Patient', { timeout: 15000 }).should('exist')
    cy.log('Check In form loaded')

    // ─── Step 8: Fill the check-in form ──────────────────────────────────────

    // Visit Date (required — must be today or future)
    cy.get('input[name="visitDate"]', { timeout: 10000 })
      .should('exist')
      .clear({ force: true })
      .type(today, { force: true })

    // Check In Time
    cy.get('input[name="checkInTime"]')
      .clear({ force: true })
      .type('08:00', { force: true })

    // Purpose of Visit (optional but good practice)
    cy.get('input[name="purposeOfVisit"]')
      .type('General Consultation', { force: true })

    // Facility Location (required — wait for API to load, then select first option)
    cy.get('select[name="facilityLocationUuid"]', { timeout: 15000 })
      .should('not.be.disabled')
    cy.get('select[name="facilityLocationUuid"]').then($sel => {
      const opts = [...$sel[0].options].map(o => o.value).filter(v => v)
      if (opts.length) {
        cy.wrap($sel).select(opts[0], { force: true })
        cy.log(`Selected facility location: ${opts[0]}`)
      } else {
        cy.log('Warning: No facility location options loaded yet')
      }
    })

    // Wait for service points to load after location is selected
    cy.wait(2000)

    // Services (required — at least one; the Autocomplete is only enabled after a location is selected)
    cy.get('#services-select').should('exist').click({ force: true })
    cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 10000 })
      .first()
      .click({ force: true })

    // ─── Step 9: Submit the check-in form ────────────────────────────────────
    cy.contains('button', 'Check In', { timeout: 10000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(4000)

    // ─── Step 10: Capture screenshot of the result ────────────────────────────
    cy.screenshot('patient-posted-to-triage')
    cy.log('Patient successfully posted to triage')
  })
})
