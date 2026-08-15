import { login } from '../../../support/modules/login'
import { ROUTES, openPage, switchTab } from '../../../support/modules/app-nav'
import { scheduleDischarge } from '../../../support/modules/inpatient'

// Discharge overview: the scheduled and completed queues. Both are usually empty
// on QA, so the shell and the queue switch are what get asserted.

describe('Inpatient discharge', () => {
  beforeEach(() => {
    cy.session('ipc-discharge', () => {
      login()
    })
    openPage(ROUTES.discharge, /Discharge Overview/i)
  })

  it('should render the discharge list shell', () => {
    cy.get('table', { timeout: 45000 }).should('exist')
    cy.get('input[placeholder="Search..."]').should('exist')

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Hospital No.', 'Patient Name', 'Sex', 'Age', 'Actions']
        .forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should show both discharge counters', () => {
    cy.contains(/Discharge Scheduled/i).should('exist')
    cy.contains(/Discharged/i).should('exist')
  })

  it('should schedule a discharge for an admitted patient', () => {
    scheduleDischarge().then((hospitalNumber) => {
      openPage(ROUTES.discharge, /Discharge Overview/i)

      cy.get('input[placeholder="Search..."]', { timeout: 20000 })
        .clear({ force: true })
        .type(hospitalNumber, { force: true, delay: 40 })
      cy.wait(2500)

      cy.contains('tbody tr', hospitalNumber, { timeout: 30000 }).should('exist')
    })
  })

  it('should complete the discharge from the scheduled queue', () => {
    scheduleDischarge().then((hospitalNumber) => {
      openPage(ROUTES.discharge, /Discharge Overview/i)
      cy.get('input[placeholder="Search..."]', { timeout: 20000 })
        .clear({ force: true })
        .type(hospitalNumber, { force: true, delay: 40 })
      cy.wait(2500)

      cy.contains('tbody tr', hospitalNumber, { timeout: 30000 })
        .find('td')
        .last()
        .find('button')
        .first()
        .click({ force: true })

      // Log the menu before acting, so a renamed action reports itself instead of
      // failing as a bare "not found".
      cy.get('body > div[class*="-menu"]', { timeout: 15000 }).then(($menu) => {
        const items = [...$menu.find('button')].map((b) => (b.innerText || '').trim())
        cy.log(`scheduled-discharge row menu: ${items.join(' | ')}`)

        const complete = items.find((t) => /discharge/i.test(t) && !/view/i.test(t))
        expect(complete, `a discharge action exists in [${items.join(', ')}]`).to.be.a('string')

        cy.intercept('POST', '**').as('completeDischarge')
        cy.intercept('PUT', '**').as('completeDischargePut')
        cy.get('body > div[class*="-menu"]').contains('button', complete).click({ force: true })
      })

      cy.wait(3000)

      // The completion step may open its own form; fill what it asks for.
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("Save")').length) {
          $body.find('textarea').each((_i, el) => {
            cy.wrap(el).clear({ force: true }).type('Discharge completed by automated test.', { force: true })
          })
          cy.contains('button', 'Save').click({ force: true })
        }
      })

      cy.wait(4000)
      cy.get('body').should('not.contain', 'Page not found')
    })
  })

  it('should switch to Discharged and back', () => {
    switchTab('Discharged')
    cy.get('body').should('not.contain', 'Page not found')

    switchTab('Discharge Scheduled')
    cy.get('table').should('exist')
  })
})
