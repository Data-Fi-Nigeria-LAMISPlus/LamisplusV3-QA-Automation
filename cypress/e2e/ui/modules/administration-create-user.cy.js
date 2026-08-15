import { login } from '../../../support/modules/login'
import { ROUTES, openPage } from '../../../support/modules/app-nav'

// Adding a user as facility admin: /tenant/users -> Add New User -> Save user.
//
// HEADS UP - this spec writes a permanent record. The user row action menu on
// /tenant/users is empty (no delete, no deactivate), so a created account cannot
// be removed through the UI and there is nothing to clean up with. Every run
// therefore leaves one more account on the QA facility. The email is suffixed
// with a timestamp so runs cannot collide and the accounts are identifiable as
// automation, but if that accumulation is unwanted this spec belongs behind an
// on-demand script rather than in the nightly glob.
//
// Roles use react-dual-listbox: pick in #rdl-available, then click
// button[aria-label="Move to selected"] to move it into #rdl-selected.
//
// Two validation traps this form sets, both worth knowing:
//  - first and last name reject digits, and the rule is only reported in a toast
//    at the end of the body (no aria-invalid, no inline message), so uniqueness
//    has to live in the email instead of a numeric name suffix
//  - the phone placeholder reads "e.g. 08012345678" but POST
//    /core/api/v1/users/facility rejects that local format with
//    "Phone number must be in a valid international format", so it needs +234...

const PASSWORD = 'QaAutomation#2026'

const openCreateForm = () => {
  openPage(ROUTES.users, /User Management/i)
  cy.contains('button', 'Add New User', { timeout: 20000 }).click({ force: true })
  cy.contains('Add New User', { timeout: 20000 }).should('exist')
  cy.url().should('include', '/tenant/users/new')
}

const fillIdentity = ({ firstName, lastName, email, phone }) => {
  cy.get('input[name="firstName"]').clear({ force: true }).type(firstName, { force: true })
  cy.get('input[name="lastName"]').clear({ force: true }).type(lastName, { force: true })
  cy.get('input[name="phoneNumber"]').clear({ force: true }).type(phone, { force: true })
  cy.get('input[name="email"]').clear({ force: true }).type(email, { force: true })
}

// The role list is fetched after the form mounts, so wait for it to populate
// before reading or selecting - otherwise the options are an empty array.
const availableRoles = () =>
  cy.get('select#rdl-available', { timeout: 30000 }).should(($select) => {
    expect($select[0].options.length, 'roles finished loading').to.be.greaterThan(0)
  })

const assignRole = (role) => {
  availableRoles()
  cy.get('select#rdl-available').select(role, { force: true })
  cy.get('button[aria-label="Move to selected"]').click({ force: true })

  cy.get('select#rdl-selected').should(($select) => {
    const selected = [...$select[0].options].map((option) => option.text.trim())
    expect(selected, `${role} moved into the selected roles`).to.include(role)
  })
}

describe('Administration - add a user', () => {
  beforeEach(() => {
    cy.session('administration-create-user', () => {
      login()
    })
  })

  it('should list the existing users with their roles and status', () => {
    openPage(ROUTES.users, /User Management/i)

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['First Name', 'Last Name', 'Email', 'Roles', 'Status', 'Actions']
        .forEach((column) => expect(actual).to.include(column))
    })
    cy.get('tbody tr').should('have.length.greaterThan', 0)
  })

  it('should show every required field on the new-user form', () => {
    openCreateForm()

    cy.get('input[name="firstName"]').should('exist')
    cy.get('input[name="lastName"]').should('exist')
    cy.get('input[name="phoneNumber"]').should('exist')
    cy.get('input[name="email"]').should('exist')
    cy.get('#password-password').should('exist')
    cy.get('#password-confirm-password').should('exist')
    cy.get('select#rdl-available').should('exist')
    cy.contains('button', 'Save user').should('exist')
    cy.contains('button', 'Cancel').should('exist')
  })

  it('should offer assignable roles and move one across', () => {
    openCreateForm()

    availableRoles().then(($select) => {
      const roles = [...$select[0].options].map((option) => option.text.trim())
      expect(roles).to.include.members(['Doctor', 'Clinical Officer', 'Lab Scientist'])
    })

    assignRole('Doctor')
  })

  it('should not create an account when the passwords do not match', () => {
    openCreateForm()

    const suffix = `${Date.now()}`
    fillIdentity({
      firstName: 'QaMismatch',
      lastName: 'Automation',
      email: `qa.mismatch.${suffix}@example.com`,
      phone: '+2348012345678',
    })
    cy.get('#password-password').clear({ force: true }).type(PASSWORD, { force: true })
    cy.get('#password-confirm-password').clear({ force: true }).type(`${PASSWORD}-different`, { force: true })
    assignRole('Doctor')

    cy.contains('button', 'Save user').click({ force: true })
    cy.wait(4000)

    // Still on the form: the mismatch was rejected rather than saved.
    cy.url().should('include', '/tenant/users/new')
  })

  it('should reject a last name containing digits', () => {
    openCreateForm()

    const suffix = `${Date.now()}`
    fillIdentity({
      firstName: 'QaAutomation',
      lastName: `User${suffix.slice(-6)}`, // digits are not allowed
      email: `qa.badname.${suffix}@example.com`,
      phone: '+2348012345678',
    })
    cy.get('#password-password').clear({ force: true }).type(PASSWORD, { force: true })
    cy.get('#password-confirm-password').clear({ force: true }).type(PASSWORD, { force: true })
    assignRole('Doctor')

    cy.get('[data-cy="user-submit"]').click({ force: true })

    // The rule is only reported in a toast at the end of the body - no field is
    // marked aria-invalid and no inline message is rendered - so a spec that
    // watched the fields alone would see the save "succeed" while nothing saved.
    cy.contains(/Last name can only contain letters, hyphens and apostrophes/i, { timeout: 20000 })
      .should('exist')
    cy.url().should('include', '/tenant/users/new')
  })

  it('should create a new user and show it in the users list', () => {
    openCreateForm()

    // Uniqueness lives in the email only: first and last name reject digits.
    const suffix = `${Date.now()}`
    const email = `qa.automation.${suffix}@example.com`

    fillIdentity({
      firstName: 'QaAutomation',
      lastName: 'Tester',
      email,
      phone: '+2348012345678',
    })
    cy.get('#password-password').clear({ force: true }).type(PASSWORD, { force: true })
    cy.get('#password-confirm-password').clear({ force: true }).type(PASSWORD, { force: true })
    assignRole('Doctor')

    // Assert the create request itself, so a rejection names the offending field
    // rather than the test only noticing a missing table row later.
    cy.intercept('POST', '**').as('createUser')
    cy.get('[data-cy="user-submit"]').click()

    cy.wait('@createUser', { timeout: 30000 }).then(({ request, response }) => {
      const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
      const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
      expect(
        response?.statusCode,
        `create user rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`
      ).to.be.oneOf([200, 201])
    })

    // And that it is really in the register afterwards.
    openPage(ROUTES.users, /User Management/i)
    cy.get('tbody', { timeout: 30000 }).invoke('text').should('include', email)
  })
})
