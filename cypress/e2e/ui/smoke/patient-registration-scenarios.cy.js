import { login } from '../../../support/modules/login'
import {
  locator,
  selectLocationCombobox,
  visitPluginRoute,
} from '../../../support/modules/patient-flow'

// Structural checks on the registration form that the main registration test
// does not cover: that every accordion section is present, that the location
// pickers cascade, and that same-as-patient copies the contact details.
//
// Previously sat unreferenced in support/modules/ as a describe() block, so it
// never ran under any spec pattern. Retargeted to the deployed form on the way
// in: the route is '/patients/register' (not '/ehr/registration/register'), and
// the location pickers are react-select comboboxes rather than MUI Autocomplete,
// so they are driven through the shared helper instead of by placeholder.

describe('Patient Registration - Additional Scenarios', () => {
  // One real login for the whole spec, replayed from cache into the other tests.
  // /core/api/v1/auth/login is rate limited to 10 requests per minute per IP and
  // the smoke suite already spends most of that budget, so logging in per test
  // here is enough to tip the suite into throttled 'stuck on /login' failures.
  beforeEach(() => {
    cy.session('registration-scenarios', () => {
      login()
    })

    visitPluginRoute('/patients/register', locator.FIRST_NAME_INPUT)
  })

  it('should display all registration accordion sections', () => {
    cy.contains('button', 'Bio Data').should('exist')
    cy.contains('button', 'Registration Details').should('exist')
    cy.contains('button', 'Next of Kin Details').should('exist')
    cy.contains('button', 'Emergency Contact').should('exist')
    cy.contains('button', 'Billing Information').should('exist')
    cy.contains('button', 'Save').should('exist')
  })

  it('should enable state and LGA only after selecting parent location', () => {
    cy.contains('button', 'Registration Details').click({ force: true })

    // Comboboxes in DOM order: 0 = Country, 1 = State, 2 = LGA. Each is locked
    // until its parent is chosen.
    cy.get('input[role="combobox"]', { timeout: 15000 }).eq(1).should('be.disabled')
    cy.get('input[role="combobox"]').eq(2).should('be.disabled')

    selectLocationCombobox(0, 'Nigeria')
    cy.get('input[role="combobox"]', { timeout: 15000 }).eq(1).should('not.be.disabled')

    selectLocationCombobox(1, 'Lagos')
    cy.get('input[role="combobox"]', { timeout: 15000 }).eq(2).should('not.be.disabled')
  })

  it('should copy patient contact details when same-as-patient is checked', () => {
    cy.get(locator.FIRST_NAME_INPUT).clear({ force: true }).type('John', { force: true })
    cy.get(locator.LAST_NAME_INPUT).clear({ force: true }).type('Doe', { force: true })

    cy.contains('button', 'Registration Details').click({ force: true })
    cy.get(locator.PHONE_NUMBER_INPUT, { timeout: 15000 })
      .clear({ force: true })
      .type('08012345678', { force: true })
    cy.get(locator.EMAIL_INPUT).clear({ force: true }).type('john.doe@example.com', { force: true })
    cy.get(locator.STREET_ADDRESS_INPUT)
      .clear({ force: true })
      .type('123 Main Street, Lagos', { force: true })

    cy.contains('button', 'Emergency Contact').click({ force: true })
    cy.contains('label', "Same as patient's contact information", { timeout: 15000 })
      .find('input[type="checkbox"]')
      .check({ force: true })

    cy.get(locator.EMERGENCY_FIRST_NAME_INPUT).should('have.value', 'John')
    cy.get(locator.EMERGENCY_LAST_NAME_INPUT).should('have.value', 'Doe')
    cy.get(locator.EMERGENCY_EMAIL_INPUT).should('have.value', 'john.doe@example.com')
    cy.get(locator.EMERGENCY_ADDRESS_INPUT).should('have.value', '123 Main Street, Lagos')
    cy.get(locator.EMERGENCY_PHONE_NUMBER_INPUT).invoke('val').should('match', /\+?\d{6,}/)
  })
})
