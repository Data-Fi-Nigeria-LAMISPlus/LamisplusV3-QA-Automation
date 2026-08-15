// Shared helpers for the per-area UI specs.
//
// Deployed-build conventions these rely on (verified against qa.lamisplus.org):
//   - no data-testid attributes exist anywhere; class names are hashed CSS
//     modules, so selectors go through roles, labels, placeholders and text
//   - list pages share one shell: input[placeholder="Search..."], a plain
//     <table>, and per-row button[aria-label="Open actions menu"] whose menu
//     renders into a body-level portal at [data-cy="action-menu"]
//   - hub pages (/opd, /pbh, /ipc) are clickable cards with no href

export const ROUTES = {
  dashboard: '/dashboard',
  patients: '/patients',
  patientRegister: '/patients/register',
  opd: '/opd',
  triage: '/opd/triage',
  consultation: '/opd/consultation',
  radiology: '/opd/radiology',
  laboratory: '/laboratory',
  pharmacy: '/pharmacy',
  publicHealth: '/pbh',
  hiv: '/pbh/hiv',
  tb: '/pbh/tb',
  immunization: '/pbh/immunization',
  malaria: '/pbh/malaria',
  nutrition: '/pbh/nutrition',
  mch: '/pbh/mch',
  familyPlanning: '/pbh/family-planning',
  inpatient: '/ipc',
  admissions: '/ipc/admissions',
  bedManagement: '/ipc/bed-management',
  discharge: '/ipc/discharge',
  administration: '/tenant/administration',
  users: '/tenant/users',
  support: '/tenant/support',
}

// Every clinical page is plugin-provided, so a slow remote yields the host's
// catch-all 404 which never self-heals. Land the page, and reload if we got the
// 404 instead of the expected heading.
export const openPage = (route, headingMatcher, attempts = 3) => {
  const tryOnce = (attempt) => {
    cy.visit(route, { failOnStatusCode: false })

    cy.get('body', { timeout: 30000 }).should(($body) => {
      const text = ($body.text() || '').replace(/\s+/g, ' ')
      const ready = headingMatcher.test(text)
      const notFound = /Page not found/i.test(text)
      expect(ready || notFound, `${route} settled`).to.equal(true)
    })

    cy.get('body').then(($body) => {
      if (headingMatcher.test(($body.text() || '').replace(/\s+/g, ' '))) return

      if (attempt >= attempts) {
        throw new Error(`${route} kept rendering the app 404 (expected ${headingMatcher})`)
      }
      cy.log(`${route} 404'd, retry ${attempt + 1}/${attempts}`)
      cy.wait(3000)
      tryOnce(attempt + 1)
    })
  }

  tryOnce(1)
}

// Hub cards carry no href; they are divs whose text starts with the label.
export const openHubCard = (label) => {
  cy.get('[class*="card"]', { timeout: 20000 })
    .filter((_i, el) => new RegExp(`^${label}`, 'i').test((el.innerText || '').replace(/\s+/g, ' ').trim()))
    .first()
    .click({ force: true })
}

export const switchTab = (label) => {
  cy.contains('button', label, { timeout: 20000 }).click({ force: true })
  cy.wait(2500)
}

// A list page is only usable if it has the shared shell, so assert it as one
// unit rather than repeating four selectors per spec.
export const expectListShell = () => {
  cy.get('table', { timeout: 45000 }).should('exist')
  cy.get('thead th').its('length').should('be.greaterThan', 1)
  cy.get('input[placeholder="Search..."]').should('exist')
}

// The row action menu is one shared component, but each plugin bundles its own
// copy and hashes the class names per plugin: the EHR build tags its portal
// [data-cy="action-menu"], the inpatient build renders
// <div class="inpatient-<hash>-menu"> with no data-cy at all. Both mount as a
// trailing child of <body>, so match either.
export const ACTION_MENU = '[data-cy="action-menu"], body > div[class*="-menu"]'

export const openFirstRowMenu = () => {
  cy.get('tbody tr', { timeout: 45000 }).should('have.length.greaterThan', 0)
  cy.get('tbody tr').first().find('button[aria-label="Open actions menu"]').click({ force: true })
  cy.get(ACTION_MENU, { timeout: 15000 }).should('exist')
}

export const actionMenuItems = () =>
  cy.get(ACTION_MENU).then(($menu) =>
    [...$menu.find('button')].map((b) => (b.innerText || '').trim()))

export const clickRowAction = (label) => {
  cy.get(ACTION_MENU, { timeout: 15000 }).contains('button', label).click({ force: true })
  cy.wait(2000)
}

// Closes the portal menu without activating anything in it.
export const dismissActionMenu = () => {
  cy.get('body').type('{esc}', { force: true })
  cy.wait(500)
}
