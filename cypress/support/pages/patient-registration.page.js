/**
 * Patient Registration Page - Reusable methods for patient registration
 * Functional approach (JavaScript modules, not class-based)
 */

const shortPause = 500
const mediumPause = 800

export const typeFieldSlowly = (selector, value) => {
  cy.get(selector, { timeout: 15000 })
    .should('exist')
    .clear({ force: true })
    .type(value, { force: true, delay: 170 })
  cy.wait(shortPause)
}

export const typeByFieldName = (fieldName, value) => {
  cy.get(`input[name="${fieldName}"]`, { timeout: 15000 })
    .should('exist')
    .clear({ force: true })
    .type(value, { force: true, delay: 170 })
  cy.wait(shortPause)
}

export const typeByLabelText = (labelMatcher, value) => {
  cy.get('body').then(($body) => {
    const label = [...$body.find('label')].find((lbl) =>
      labelMatcher.test((lbl.innerText || '').trim())
    )

    if (label) {
      const input = label.closest('div')?.querySelector('input')
      if (input) {
        cy.wrap(input).clear({ force: true }).type(value, { force: true, delay: 170 })
        cy.wait(shortPause)
        return
      }
    }

    throw new Error(`Unable to find input for label matching: ${labelMatcher}`)
  })
}

export const selectNativeOption = (selector, optionValue) => {
  cy.get(selector, { timeout: 15000 })
    .should('exist')
    .should('not.be.disabled')
    .select(optionValue, { force: true })
  cy.wait(mediumPause)
}

export const selectFirstNativeOption = (selector) => {
  cy.get(selector, { timeout: 15000 })
    .should('exist')
    .should('not.be.disabled')
    .then(($sel) => {
      const options = [...$sel[0].options].map((opt) => opt.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
  cy.wait(mediumPause)
}

export const clickButton = (buttonText) => {
  cy.contains('button', buttonText, { timeout: 15000 })
    .should('exist')
    .click({ force: true })
  cy.wait(mediumPause)
}

export const fillBasicInfo = (data) => {
  if (data.firstName) typeByFieldName('firstName', data.firstName)
  if (data.middleName) typeByFieldName('middleName', data.middleName)
  if (data.lastName) typeByFieldName('lastName', data.lastName)
  if (data.hospitalNumber) typeByFieldName('hospitalNumber', data.hospitalNumber)
  if (data.nationalIdentityNumber) typeByFieldName('nationalIdentityNumber', data.nationalIdentityNumber)
  if (data.dateOfBirth) typeByFieldName('dateOfBirth', data.dateOfBirth)
}

export const fillContactInfo = (data) => {
  if (data.phoneNumber) typeByFieldName('phoneNumber', data.phoneNumber)
  if (data.alternativePhoneNumber) typeByFieldName('alternativePhoneNumber', data.alternativePhoneNumber)
  if (data.email) typeByFieldName('email', data.email)
}

export const navigateToRegistration = () => {
  cy.visit('/patients/register')
  cy.get('input[name="firstName"]', { timeout: 15000 }).should('exist')
  cy.wait(mediumPause)
}

export const saveRegistration = () => {
  cy.contains('button', 'Save', { timeout: 15000 }).click({ force: true })
  cy.wait(4000)
}
