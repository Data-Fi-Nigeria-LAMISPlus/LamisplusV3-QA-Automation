/**
 * Login Page - Reusable methods for login interactions
 * Functional approach (JavaScript modules, not class-based)
 */

export const typeEmailSlowly = (email) => {
  cy.get('input[type="email"]', { timeout: 15000 })
    .should('exist')
    .clear({ force: true })
    .type(email, { delay: 120 })
  cy.wait(600)
}

export const typePasswordSlowly = (password) => {
  cy.get('input[type="password"]', { timeout: 15000 })
    .should('exist')
    .clear({ force: true })
    .type(password, { delay: 120 })
  cy.wait(600)
}

export const clickLoginButton = () => {
  cy.get('button[type="submit"]', { timeout: 15000 })
    .should('exist')
    .click({ force: true })
  cy.wait(1000)
}

export const verifyLoginSuccess = () => {
  cy.url({ timeout: 30000 }).should('not.include', '/login')
  cy.location('pathname', { timeout: 30000 }).then((pathname) => {
    if (!pathname.includes('/ehr/dashboard')) {
      cy.visit('/ehr/dashboard')
    }
  })
}

export const verifyErrorMessage = (errorText) => {
  cy.contains(errorText, { timeout: 10000 }).should('be.visible')
}

export const quickLogin = (email, password) => {
  cy.visit('/login')
  typeEmailSlowly(email)
  typePasswordSlowly(password)
  clickLoginButton()
  verifyLoginSuccess()
}
