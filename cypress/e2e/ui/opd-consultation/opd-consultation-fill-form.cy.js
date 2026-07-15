import { fillConsultationForm } from '../../../support/modules/opd-consultation-fill-form'

const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

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
    if (!pathname.includes('/ehr/dashboard')) {
      cy.visit('/ehr/dashboard')
    }
  })
}

describe('OPD Consultation - Fill Consultation Form', () => {
  it('should log in successfully', () => {
    loginToApp()
  });
  it('should open consultation page, find a patient, use Action menu, fill consultation form, and save', () => {
    loginToApp()

    const today = new Date().toISOString().split('T')[0]
    const uniqueSuffix = `${Date.now()}`
    const hospitalNumber = `HOSP-CY-${uniqueSuffix.slice(-8)}`
    const uniqueEmail = `john.${uniqueSuffix}@example.com`
    const uniqueNin = uniqueSuffix.slice(-11).padStart(11, '0')

    const typeSlowly = (selector, value) => {
      cy.get(selector)
        .should('exist')
        .clear({ force: true })
        .type(value, { force: true, delay: 170 })
      cy.wait(500)
    }

    const typeInputByNameOrLabel = (name, labelMatcher, value) => {
      cy.get('body').then(($body) => {
        const namedInput = $body.find(`input[name="${name}"]`)
        if (namedInput.length) {
          cy.wrap(namedInput[0]).clear({ force: true }).type(value, { force: true })
          return
        }

        const matchedLabel = [...$body.find('label')].find((label) =>
          labelMatcher.test((label.innerText || '').trim())
        )

        if (matchedLabel) {
          const section = matchedLabel.closest('div')
          const labelInput = section?.querySelector('input')

          if (labelInput) {
            cy.wrap(labelInput).clear({ force: true }).type(value, { force: true })
            return
          }
        }

        if (name === 'dateOfBirth') {
          const dateInputs = $body.find('input[placeholder="YYYY-MM-DD"]')
          if (dateInputs.length > 1) {
            cy.wrap(dateInputs[1]).clear({ force: true }).type(value, { force: true })
            return
          }
        }

        throw new Error(`Unable to find input for ${name}`)
      })
    }

    const selectAutocompleteOption = (placeholder, optionText) => {
      cy.get('body').then(($body) => {
        const exactInput = $body.find(`input[placeholder="${placeholder}"]`)
        const placeholderToken = placeholder.replace(/^select\s+/i, '').trim().toLowerCase()
        const partialInput = [...$body.find('input[placeholder]')].find((input) =>
          (input.getAttribute('placeholder') || '').toLowerCase().includes(placeholderToken)
        )
        const targetInput = exactInput[0] || partialInput

        if (!targetInput) {
          cy.log(`Skipping autocomplete field not found: ${placeholder}`)
          return
        }

        cy.wrap(targetInput)
          .click({ force: true })
          .clear({ force: true })
          .type(optionText, { force: true, delay: 120 })
      })

      cy.wait(700)
      cy.get('body').then(($body) => {
        const options = $body.find('.MuiAutocomplete-popper [role="option"]')
        if (!options.length) {
          cy.log(`No options available for: ${placeholder}`)
          return
        }

        const matchedOption = [...options].find((option) =>
          new RegExp(optionText, 'i').test(option.innerText)
        )

        cy.wrap(matchedOption || options[0]).click({ force: true })
      })

      cy.wait(700)
    }

    const selectFirstNativeOption = (selector) => {
      cy.get(selector, { timeout: 15000 })
        .should('exist')
        .should('not.be.disabled')
        .then(($sel) => {
          const options = [...$sel[0].options].map((opt) => opt.value).filter(Boolean)
          if (options.length) {
            cy.wrap($sel).select(options[0], { force: true })
          }
        })
      cy.wait(700)
    }

    const selectMUIOptionMatching = (matcher) => {
      cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 15000 }).then(($options) => {
        const matchedOption = [...$options].find((option) => matcher.test(option.innerText))
        if (matchedOption) {
          cy.wrap(matchedOption).click({ force: true })
        } else {
          cy.wrap($options[0]).click({ force: true })
        }
      })
      cy.wait(700)
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

    cy.get('body', { timeout: 30000 }).then(($body) => {
      const hasDashboardTitle = [...$body.find('h1')].some((h) => /dashboard/i.test(h.innerText))
      const hasDashboardTabs = $body.find('[data-testid="opd-dashboard-dashboard-button"]').length > 0

      if (hasDashboardTitle || hasDashboardTabs) {
        cy.log('Dashboard is visible after login')
      } else {
        cy.log('Dashboard UI not visible for this session, continuing with OPD flow')
      }
    })
    cy.wait(2500)

    // Create a dedicated patient, then post that patient through registration -> triage -> consultation.
    cy.visit('/patients/register')
    cy.get('input[name="firstName"]', { timeout: 15000 }).should('exist')

    typeInputByNameOrLabel('dateOfRegistration', /date of registration/i, today)
    cy.get('input[name="hospitalNumber"]').type(hospitalNumber, { force: true })
    cy.get('input[name="nationalIdentityNumber"]').type(uniqueNin, { force: true })
    cy.get('input[name="firstName"]').type('John', { force: true })
    cy.get('input[name="middleName"]').type('David', { force: true })
    cy.get('input[name="lastName"]').type('Doe', { force: true })

    cy.get('select[name="sex"]').then(($sel) => {
      const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })

    typeInputByNameOrLabel('dateOfBirth', /^date of birth\s*\*?$/i, '1990-01-15')

    cy.contains('button', 'Registration Details').click({ force: true })
    cy.get('select[name="maritalStatus"]', { timeout: 15000 }).then(($sel) => {
      const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
    cy.get('select[name="employmentStatus"]').then(($sel) => {
      const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
    cy.get('select[name="educationLevel"]').then(($sel) => {
      const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
    cy.get('input[name="phoneNumber"]').clear({ force: true }).type('+2348012345678', { force: true })
    cy.get('input[name="alternativePhoneNumber"]').clear({ force: true }).type('+2348087654321', { force: true })
    cy.get('input[name="email"]').type(uniqueEmail, { force: true })
    selectAutocompleteOption('Select country', 'Nigeria')
    selectAutocompleteOption('Select state', 'Lagos')
    cy.get('body').then(($body) => {
      const exactLgaInput = $body.find('input[placeholder="Select LGA"]')
      const partialLgaInput = [...$body.find('input[placeholder]')].find((input) =>
        (input.getAttribute('placeholder') || '').toLowerCase().includes('lga')
      )
      const lgaInput = exactLgaInput[0] || partialLgaInput

      if (!lgaInput) {
        cy.log('Skipping LGA field because no matching input was found')
        return
      }

      cy.wrap(lgaInput).click({ force: true })
    })
    cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 15000 }).first().click({ force: true })
    cy.get('input[name="streetAddress"]').type('123 Main Street, Lagos', { force: true })
    cy.get('input[name="landmark"]').type('Near Central Market', { force: true })

    cy.contains('button', 'Next of Kin Details').click({ force: true })
    cy.get('select[name="relationshipType"]', { timeout: 15000 }).then(($sel) => {
      const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
    cy.get('input[name="kinFirstName"]').type('Jane', { force: true })
    cy.get('input[name="kinMiddleName"]').type('Mary', { force: true })
    cy.get('input[name="kinLastName"]').type('Doe', { force: true })
    cy.get('input[name="kinPhoneNumber"]').clear({ force: true }).type('+2349012345678', { force: true })
    cy.get('input[name="kinEmail"]').type(`jane.${uniqueSuffix}@example.com`, { force: true })
    cy.get('input[name="kinAddress"]').type('456 Secondary Street, Lagos', { force: true })

    cy.contains('button', 'Emergency Contact').click({ force: true })
    cy.get('input[name="emergencyFirstName"]', { timeout: 15000 }).type('Michael', { force: true })
    cy.get('input[name="emergencyLastName"]').type('Smith', { force: true })
    cy.get('input[name="emergencyPhoneNumber"]').clear({ force: true }).type('+2347012345678', { force: true })
    cy.get('input[name="emergencyEmail"]').type(`michael.${uniqueSuffix}@example.com`, { force: true })
    cy.get('select[name="emergencyRelationshipType"]').then(($sel) => {
      const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
    cy.get('input[name="emergencyAddress"]').type('789 Third Avenue, Lagos', { force: true })

    cy.contains('button', 'Billing Information').click({ force: true })
    cy.get('select[name="billingType"]', { timeout: 15000 }).then(($sel) => {
      const options = [...$sel[0].options].map((option) => option.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
    cy.get('input[name="organisationEmployer"]').type('ABC Corporation', { force: true })

    cy.contains('button', 'Save', { timeout: 15000 }).click({ force: true })
    cy.wait(4000)

    cy.visit('/ehr/registration')
    clickGridActionForPatient(hospitalNumber)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Dashboard', { timeout: 10000 })
      .click({ force: true })
    cy.wait(2000)

    cy.contains('Patient Details Dashboard', { timeout: 15000 }).should('exist')
    cy.contains('button', 'Post Patient', { timeout: 15000 }).click({ force: true })
    cy.wait(2000)

    cy.contains('Check in Patient', { timeout: 15000 }).should('exist')
    typeSlowly('input[name="visitDate"]', today)
    typeSlowly('input[name="checkInTime"]', '08:00')
    typeSlowly('input[name="purposeOfVisit"]', 'General Consultation')
    selectFirstNativeOption('select[name="facilityLocationUuid"]')
    cy.wait(2000)
    cy.get('#services-select').click({ force: true })
    selectMUIOptionMatching(/triage/i)
    cy.contains('button', 'Check In', { timeout: 10000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(2500)

    cy.visit('/ehr/triage')
    cy.contains('Triage', { timeout: 15000 }).should('exist')
    clickGridActionForPatient(hospitalNumber)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Capture Vitals', { timeout: 10000 })
      .click({ force: true })
    cy.wait(1500)

    cy.contains('Record Triage Details', { timeout: 15000 }).should('exist')
    typeSlowly('input[name="vitalSignDate"]', today)
    typeSlowly('input[name="heartRate"]', '72')
    typeSlowly('input[name="respiratoryRate"]', '18')
    typeSlowly('input[name="temperature"]', '36.8')
    typeSlowly('input[name="bloodPressureSystolic"]', '120')
    typeSlowly('input[name="bloodPressureDiastolic"]', '80')
    typeSlowly('input[name="oxygenSaturation"]', '98')
    typeSlowly('input[name="bodyWeight"]', '70')
    typeSlowly('input[name="height"]', '175')
    cy.contains('button', 'Save', { timeout: 10000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(2500)

    cy.contains('button', 'Patient Attended To', { timeout: 15000 }).click({ force: true })
    cy.wait(1500)
    clickGridActionForPatient(hospitalNumber)

    cy.contains('[data-testid="core-common-action-menu-button-1"]', 'Post Patient', { timeout: 10000 })
      .click({ force: true })
    cy.wait(1500)

    cy.contains('Check in Patient', { timeout: 15000 }).should('exist')
    typeSlowly('input[name="visitDate"]', today)
    typeSlowly('input[name="checkInTime"]', '09:00')
    typeSlowly('input[name="purposeOfVisit"]', 'Consultation Review')
    selectFirstNativeOption('select[name="facilityLocationUuid"]')
    cy.wait(2000)
    cy.get('#services-select').click({ force: true })
    selectMUIOptionMatching(/consult/i)
    cy.contains('button', 'Check In', { timeout: 10000 })
      .should('not.be.disabled')
      .click({ force: true })
    cy.wait(2500)

    fillConsultationForm({ hospitalNumber, today })
  })
})
