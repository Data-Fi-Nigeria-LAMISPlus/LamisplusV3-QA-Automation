const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

// The login-page checks that the main login suite does not already cover:
// responsive layout, the placeholder/i18n surface, and the optional auth steps
// (CAPTCHA, 2FA) this build does not ship.
//
// Retargeted from the unreferenced describe() block in support/modules/
// otherloginscenarios.js. Of its 37 tests, 31 duplicated the scenarios in
// login.js that the smoke suite already runs correctly, so only these survive.
//
// Two things were wrong with the originals:
//  - the "if present" tests used cy.get('[data-cy="captcha"]'), which throws when
//    nothing matches, so the `if ($el.length)` guard could never run. Conditional
//    checks have to query through the body instead.
//  - several asserted error copy this app never emits ('Please verify your
//    email', 'Password too weak') or routes it does not serve ('/reset-password',
//    the live recovery route is '/forgot-password'). Those now assert the
//    behaviour the app actually has.

describe('Login Page - Edge Cases', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/login')
    cy.get('input[type="email"]', { timeout: 15000 }).should('exist')
    cy.get('input[type="password"]', { timeout: 15000 }).should('exist')
  })

  it('should keep the form usable at desktop size', () => {
    cy.viewport(1280, 720)

    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should keep the form usable on phone and tablet viewports', () => {
    cy.viewport('iphone-6')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')

    cy.viewport('ipad-2')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should label the email field with a placeholder', () => {
    cy.get('input[type="email"]')
      .should('have.attr', 'placeholder')
      .and('not.be.empty')
  })

  it('should show no CAPTCHA on this build, and a visible one if it is ever added', () => {
    cy.get('body').then(($body) => {
      const captcha = $body.find('[data-cy="captcha"]')
      cy.log(`captcha elements present: ${captcha.length}`)

      if (captcha.length) {
        cy.wrap(captcha).should('be.visible')
      } else {
        cy.get('[data-cy="captcha"]').should('not.exist')
      }
    })
  })

  it('should sign in, completing a 2FA step only if one is presented', () => {
    cy.get('input[type="email"]').type(EMAIL, { delay: 0 })
    cy.get('input[type="password"]').type(PASSWORD, { delay: 0 })
    cy.get('button[type="submit"]').click()

    cy.get('body', { timeout: 30000 }).then(($body) => {
      const codeInput = $body.find('[data-cy="2fa-code"]')
      cy.log(`2FA prompts present: ${codeInput.length}`)

      if (codeInput.length) {
        cy.wrap(codeInput).type('123456', { force: true })
        cy.get('[data-cy="verify-2fa"]').click({ force: true })
      }
    })

    cy.url({ timeout: 30000 }).should('not.include', '/login')
  })

  it('should reject an account that does not exist and stay on the login page', () => {
    cy.get('input[type="email"]').type('unverified@email.com', { delay: 0 })
    cy.get('input[type="password"]').type('password123', { delay: 0 })
    cy.get('button[type="submit"]').click()

    cy.url({ timeout: 20000 }).should('include', '/login')
    cy.get('input[type="email"]').should('exist')
  })

  it('should reject a wrong password and offer the forgot-password route', () => {
    cy.get('input[type="email"]').type(EMAIL, { delay: 0 })
    cy.get('input[type="password"]').type('expiredpassword', { delay: 0 })
    cy.get('button[type="submit"]').click()

    cy.url({ timeout: 20000 }).should('include', '/login')

    // The recovery path this build serves is /forgot-password; there is no
    // /reset-password route and no password-expiry redirect.
    cy.contains(/forgot password/i).should('be.visible').click({ force: true })
    cy.url({ timeout: 20000 }).should('include', '/forgot-password')
  })
})
