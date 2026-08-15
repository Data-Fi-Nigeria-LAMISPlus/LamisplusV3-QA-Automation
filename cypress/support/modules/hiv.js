// Navigation for the HIV programme's five services (/pbh/hiv).
//
// How these worklists differ from the rest of the app, all verified on
// qa.lamisplus.org:
//   - HTS, ART Enrollment, PrEP and PMTCT are still served from hardcoded rows in
//     the plugin, so their queues always have patients and no posting is needed.
//     Only Viral Hepatitis reads real data.
//   - the forms are opened from a row action, and their deployed routes carry no
//     :patientId even though the source declares one. A direct visit to
//     /pbh/hiv/hts/form/1 therefore matches nothing and renders a blank page with
//     only the breadcrumb - go through the row action, always.
//   - the action menu is a body-level portal (div.pbh-<hash>-menu), which the
//     shared ACTION_MENU selector already covers.

import { ACTION_MENU } from './app-nav'

export const HIV_ROUTES = {
  hub: '/pbh/hiv',
  hts: '/pbh/hiv/hts',
  artEnrollment: '/pbh/hiv/art-enrollment',
  prep: '/pbh/hiv/prep-services',
  pmtct: '/pbh/hiv/pmtct-services',
  viralHepatitis: '/pbh/hiv/viral-hepatitis',
}

// These pages are plugin-provided: on a cold load a slow remote leaves the host's
// catch-all 404 sitting there for good, and only a reload recovers it.
export const openHivPage = (route, headingMatcher, attempts = 3) => {
  const tryOnce = (attempt) => {
    cy.visit(route, { failOnStatusCode: false })

    cy.get('body', { timeout: 30000 }).should(($body) => {
      const text = ($body.text() || '').replace(/\s+/g, ' ')
      expect(headingMatcher.test(text) || /Page not found/i.test(text), `${route} settled`).to.equal(true)
    })

    cy.get('body').then(($body) => {
      if (headingMatcher.test(($body.text() || '').replace(/\s+/g, ' '))) return
      if (attempt >= attempts) throw new Error(`${route} kept rendering the app 404`)
      cy.log(`${route} 404'd, retry ${attempt + 1}/${attempts}`)
      cy.wait(3000)
      tryOnce(attempt + 1)
    })
  }

  tryOnce(1)
  cy.wait(2500)
}

export const switchWorklistTab = (label) => {
  cy.contains('button', label, { timeout: 20000 }).click({ force: true })
  cy.wait(3000)
}

export const openFirstRowActions = () => {
  cy.get('tbody tr', { timeout: 30000 }).should('have.length.greaterThan', 0)
  cy.get('tbody tr').first().find('button[aria-label="Open actions menu"]').click({ force: true })
  cy.get(ACTION_MENU, { timeout: 15000 }).should('exist')
}

export const rowActionLabels = () =>
  cy.get(ACTION_MENU).then(($menu) => [...$menu.find('button')].map((button) => (button.innerText || '').trim()))

// Opens a form from the first row of a worklist. `tab` switches queue first,
// since which actions a row offers depends on which queue it is in - a waiting
// patient only offers enrollment, an enrolled one offers the follow-on forms.
export const openHivForm = ({ route, heading, tab, action, expectUrl, expectText }) => {
  openHivPage(route, heading)

  if (tab) switchWorklistTab(tab)

  openFirstRowActions()
  cy.get(ACTION_MENU).contains('button', action).click({ force: true })

  if (expectUrl) cy.url({ timeout: 30000 }).should('include', expectUrl)
  if (expectText) cy.contains(expectText, { timeout: 30000 }).should('exist')
  cy.wait(2000)
}
