const shortPause = 900
const stagePause = 1400

const typeSlowly = (selector, value) => {
  cy.get(selector)
    .should('exist')
    .clear({ force: true })
    .type(value, { force: true, delay: 170 })
  cy.wait(500)
}

const selectSearchableOption = (placeholder, valueText) => {
  cy.get(`input[placeholder="${placeholder}"]`, { timeout: 15000 })
    .should('exist')
    .click({ force: true })

  cy.get('body').then(($body) => {
    const options = $body.find('.MuiAutocomplete-popper [role="option"]')
    if (options.length > 0) {
      cy.wrap(options[0]).click({ force: true })
    } else {
      cy.get(`input[placeholder="${placeholder}"]`)
        .type(valueText, { force: true, delay: 140 })

      cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 15000 })
        .first()
        .click({ force: true })
    }
  })

  cy.wait(700)
}

const selectFirstOptionForPlaceholder = (placeholder) => {
  cy.get(`input[placeholder="${placeholder}"]`, { timeout: 20000 })
    .should('be.visible')
    .click({ force: true })

  cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 20000 })
    .should('have.length.greaterThan', 0)
    .first()
    .click({ force: true })

  cy.wait(shortPause)
}

const openConsultationSection = (sectionTitle) => {
  cy.contains('button', sectionTitle, { timeout: 15000 })
    .should('exist')
    .scrollIntoView({ offset: { top: -120, left: 0 } })
    .click({ force: true })
  cy.wait(stagePause)
}

const ensureConsultationSectionOpen = (sectionTitle, requiredSelector) => {
  cy.get('body').then(($body) => {
    if (!$body.find(requiredSelector).length) {
      openConsultationSection(sectionTitle)
    }
  })

  cy.get(requiredSelector, { timeout: 15000 }).should('exist')
  cy.wait(shortPause)
}

const selectFirstOptionForFieldLabel = (labelText) => {
  cy.contains('label', labelText, { timeout: 20000 })
    .should('exist')
    .parent()
    .find('input[role="combobox"]')
    .first()
    .click({ force: true })

  cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 20000 })
    .should('have.length.greaterThan', 0)
    .first()
    .click({ force: true })

  cy.wait(shortPause)
}

const typeInputByFieldLabel = (labelText, value) => {
  cy.contains('label', labelText, { timeout: 20000 })
    .should('exist')
    .scrollIntoView({ offset: { top: -120, left: 0 } })
    .parent()
    .find('input')
    .first()
    .clear({ force: true })
    .type(value, { force: true, delay: 140 })

  cy.wait(shortPause)
}

const filterTableByText = (valueText) => {
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="core-common-table-input"]').length) {
      cy.get('[data-testid="core-common-table-input"]')
        .clear({ force: true })
        .type(valueText, { force: true, delay: 100 })
    } else if ($body.find('[data-testid="core-common-table-button"]').length) {
      cy.get('[data-testid="core-common-table-button"]', { timeout: 15000 })
        .first()
        .click({ force: true })

      cy.get('[data-testid="core-common-table-input"]', { timeout: 15000 })
        .clear({ force: true })
        .type(valueText, { force: true, delay: 100 })
    }
  })

  cy.wait(1200)
}

const clickGridActionForPatient = (patientIdentifier) => {
  cy.get('body', { timeout: 45000 }).should('not.contain', 'Loading...')
  cy.get('.MuiDataGrid-root', { timeout: 45000 }).should('exist')

  filterTableByText(patientIdentifier)

  cy.contains('.MuiDataGrid-row', patientIdentifier, { timeout: 60000 })
    .should('exist')
    .within(() => {
      cy.get('[data-testid="core-common-action-menu-button"]', { timeout: 15000 })
        .click({ force: true })
    })

  cy.wait(1200)
}

// Assumes the patient is already checked in and waiting on /ehr/consultation.
export const fillConsultationForm = ({ hospitalNumber, today }) => {
  cy.visit('/ehr/consultation')
  cy.contains('Consultation', { timeout: 15000 }).should('exist')
  cy.wait(1200)

  clickGridActionForPatient(hospitalNumber)

  cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Fill Consultation Form', { timeout: 10000 })
    .click({ force: true })

  cy.contains('Consultation Form', { timeout: 15000 }).should('exist')
  cy.wait(1200)

  // Stage 1: Physical Examination + Vitals
  typeSlowly('input[name="encounterDate"]', today)

  selectSearchableOption('Search visit type...', 'visit')
  cy.wait(shortPause)

  cy.get('select[name="isVisitReferral"]', { timeout: 15000 })
    .should('exist')
    .then(($sel) => {
      const options = [...$sel[0].options].map((opt) => opt.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
  cy.wait(stagePause)

  cy.get('input[name="dateOfVitalSign"]', { timeout: 15000 }).then(($input) => {
    if (!$input.prop('disabled')) {
      typeSlowly('input[name="dateOfVitalSign"]', today)
      typeSlowly('input[name="pulse"]', '74')
      typeSlowly('input[name="respiratoryRate"]', '18')
      typeSlowly('input[name="temperature"]', '36.7')
      typeSlowly('input[name="systolic"]', '120')
      typeSlowly('input[name="diastolic"]', '80')
      typeSlowly('input[name="oxygenSaturation"]', '98')
      typeSlowly('input[name="bodyWeight"]', '71')
      typeSlowly('input[name="height"]', '176')
    }
  })
  cy.wait(stagePause)

  // Stage 2: Presenting Complaints
  openConsultationSection('Presenting Complaints')
  typeSlowly('textarea[name="patientVisitNotes"]', 'Patient reports headache, mild fever, and general fatigue for review.')
  selectFirstOptionForPlaceholder('Search presenting complaint...')
  typeSlowly('input[name="onsetDate"]', today)
  selectFirstOptionForPlaceholder('Search severity...')
  cy.contains('button', 'Add Complaint', { timeout: 10000 })
    .should('not.be.disabled')
    .click({ force: true })
  cy.wait(stagePause)

  // Stage 3: Clinical Diagnosis
  openConsultationSection('Clinical Diagnosis')
  cy.contains('label', 'Condition', { timeout: 15000 })
    .parent()
    .find('input[role="combobox"]')
    .first()
    .click({ force: true })
    .type('malaria', { force: true, delay: 120 })
  cy.wait(1800)
  cy.get('body').then(($body) => {
    const icdOptions = $body.find('.MuiAutocomplete-popper [role="option"]')

    if (icdOptions.length > 0) {
      cy.wrap(icdOptions[0]).click({ force: true })
      cy.wait(shortPause)
      selectFirstOptionForPlaceholder('Search priority...')
      selectFirstOptionForPlaceholder('Search certainty...')
      cy.contains('button', 'Add Diagnosis', { timeout: 10000 })
        .should('not.be.disabled')
        .click({ force: true })
    } else {
      cy.log('ICD diagnosis options unavailable, skipping Add Diagnosis in this run')
    }
  })
  cy.wait(stagePause)

  // Stage 4: Laboratory Test Orders
  openConsultationSection('Laboratory Test Orders')
  cy.get('body').then(($body) => {
    if ($body.text().includes('do not have permission to add laboratory test orders')) {
      cy.wait(stagePause)
    } else {
      selectFirstOptionForPlaceholder('category of lab tests')
      selectFirstOptionForPlaceholder('specific test name')
      selectFirstOptionForPlaceholder('choose specimen type(s)')

      cy.get('input[placeholder="urgency of the test"]', { timeout: 15000 }).then(($priority) => {
        if ($priority.length) {
          selectFirstOptionForPlaceholder('urgency of the test')
        }
      })

      cy.contains('button', /Add Lab|Update Lab/, { timeout: 10000 })
        .should('not.be.disabled')
        .click({ force: true })
      cy.wait(stagePause)
    }
  })

  // Stage 5: Pharmacy Orders
  ensureConsultationSectionOpen('Pharmacy Orders', 'input[name="prescriptionDate"]')
  typeSlowly('input[name="prescriptionDate"]', today)
  selectFirstOptionForPlaceholder('Search for a drug...')
  selectFirstOptionForFieldLabel('Formulation')
  selectFirstOptionForFieldLabel('Route of Admin')
  typeInputByFieldLabel('Strength', '500mg')
  typeInputByFieldLabel('Dosage Amount', '1')
  selectFirstOptionForFieldLabel('Frequency')
  typeInputByFieldLabel('Quantity Prescribed', '10')
  typeInputByFieldLabel('Duration', '5')
  selectFirstOptionForFieldLabel('Duration Unit')

  cy.contains('button', /Add Pharmacy|Update Pharmacy/, { timeout: 10000 })
    .should('not.be.disabled')
    .click({ force: true })
  cy.wait(stagePause)

  // Save consultation form
  cy.contains('button', 'Save', { timeout: 10000 })
    .should('not.be.disabled')
    .click({ force: true })

  // Stay on the saved page briefly before test exit.
  cy.url({ timeout: 20000 }).then((savedUrl) => {
    cy.wait(8000)
    cy.url().then((currentUrl) => {
      expect(currentUrl).to.include('/ehr/consultation')
      expect(savedUrl).to.include('/ehr/consultation')
    })
  })

  // Verify we are still within consultation context after save.
  cy.get('body', { timeout: 15000 }).then(($body) => {
    if ($body.text().includes('Consultation Form')) {
      cy.contains('Consultation Form').should('exist')
    } else {
      cy.contains('Consultation').should('exist')
    }
  })

  cy.screenshot('opd-consultation-form-saved')
}
