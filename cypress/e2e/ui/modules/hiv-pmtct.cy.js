import { login } from '../../../support/modules/login'
import { ACTION_MENU } from '../../../support/modules/app-nav'
import {
  HIV_ROUTES,
  openFirstRowActions,
  openHivPage,
  rowActionLabels,
  switchWorklistTab,
} from '../../../support/modules/hiv'

// PMTCT services (/pbh/hiv/pmtct-services).
//
// There is no PMTCT form to fill. The module ships one page - the worklist - and
// its row actions are unimplemented stubs: every handler is a console.log with a
// "// Navigate to ..." comment where the navigation should be, and the plugin
// declares no route for an enrollment form. So "Enroll Patient" is a button that
// goes nowhere.
//
// This spec covers the worklist that does exist and pins the gap, so that a PMTCT
// form arriving is noticed rather than assumed.

describe('HIV - PMTCT services', () => {
  beforeEach(() => {
    cy.session('hiv-pmtct', () => {
      login()
    })
    openHivPage(HIV_ROUTES.pmtct, /PMTCT Services/i)
  })

  it('should render the worklist with its expected columns', () => {
    cy.get('table', { timeout: 30000 }).should('exist')

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Patient ID', 'Sex', 'Age', 'Actions'].forEach((column) => expect(actual).to.include(column))
    })

    cy.get('tbody tr').should('have.length.greaterThan', 0)
  })

  it('should offer both queues', () => {
    cy.contains('button', 'Patient in waiting').should('exist')
    cy.contains('button', 'PMTCT Enrolled Patients').should('exist')

    switchWorklistTab('PMTCT Enrolled Patients')
    cy.get('body').should('not.contain', 'Page not found')

    switchWorklistTab('Patient in waiting')
    cy.get('table').should('exist')
  })

  // Records the gap rather than a feature. When a PMTCT enrollment form is built,
  // this test will fail - replace it with the fill-and-save tests the other HIV
  // modules have.
  it('should offer only an enrollment action, which is not yet implemented (no form exists)', () => {
    openFirstRowActions()

    rowActionLabels().then((labels) => {
      expect(labels, 'the only action offered').to.deep.equal(['Enroll Patient'])
    })

    cy.get(ACTION_MENU).contains('button', 'Enroll Patient').click({ force: true })
    cy.wait(3000)

    // The click is a no-op: no navigation, no form, no error.
    cy.url().should('include', HIV_ROUTES.pmtct)
    cy.contains(/PMTCT Services/i).should('exist')
    cy.get('form').should('not.exist')
  })
})
