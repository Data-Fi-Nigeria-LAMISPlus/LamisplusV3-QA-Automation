export const locator = {
  EMAIL_INPUT :'input[type="email"]',
  PASSWORD_INPUT : 'input[type="password"]',
  SUBMIT_BUTTON : 'button[type="submit"]'
}

export const login = () => {
  cy.visit('/login')
  cy.get(locator.EMAIL_INPUT).type('facility_admin@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('p@55W0rd!')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('not.include', '/login')
}