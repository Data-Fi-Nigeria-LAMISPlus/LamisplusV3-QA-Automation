import { login } from '../../../support/modules/login'
import {
  ACTION_MENU,
  actionMenuItems,
  openFirstRowMenu,
  openPage,
  switchTab,
} from '../../../support/modules/app-nav'

// TB Treatment (/pbh/tb/treatment).
//
// There is no TB treatment form to fill. The service ships one page - the worklist -
// and every row action is an unimplemented stub: "Enroll in Treatment", "View
// Details", "Edit Patient" and "Patient Details" are all console.log calls with a
// "// Navigate to ..." comment where the navigation should be, and the plugin
// declares no route for a treatment form. Same state as PMTCT.
//
// So this spec covers the worklist that does exist - including the richer column
// set the attended queue adds - and pins the gap so a form arriving is noticed.

const ROUTE = '/pbh/tb/treatment'
const WAITING_TAB = 'Patient in Waiting'
const ATTENDED_TAB = 'Patient Attended To'

describe('TB - Treatment', () => {
  beforeEach(() => {
    cy.session('pbh-tb-treatment', () => {
      login()
    })
    openPage(ROUTE, /TB Treatment Services/i)
  })

  it('should render the waiting queue with its expected columns', () => {
    cy.get('table', { timeout: 30000 }).should('exist')

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Patient ID', 'Sex', 'Age', 'Actions'].forEach((column) => expect(actual).to.include(column))
    })

    cy.get('tbody tr').should('have.length.greaterThan', 0)
  })

  it('should add the treatment columns on the attended queue', () => {
    cy.contains('button', WAITING_TAB).should('exist')
    cy.contains('button', ATTENDED_TAB).should('exist')

    switchTab(ATTENDED_TAB)

    // The attended queue is where the treatment record itself shows up.
    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['TB Type', 'Treatment Start Date', 'Regimen', 'HIV Co-infection', 'Outcome', 'Next Follow-up']
        .forEach((column) => expect(actual).to.include(column))
    })

    switchTab(WAITING_TAB)
    cy.get('table').should('exist')
  })

  // Records the gap rather than a feature. When a TB treatment form is built these
  // two tests will fail - replace them with fill-and-save tests like the TB
  // screening spec has.
  it('should offer only enrollment on a waiting patient, which is not yet implemented', () => {
    openFirstRowMenu()

    actionMenuItems().then((labels) => {
      expect(labels, 'the only action offered').to.deep.equal(['Enroll in Treatment'])
    })

    cy.get(ACTION_MENU).contains('button', 'Enroll in Treatment').click({ force: true })
    cy.wait(3000)

    // The click is a no-op: no navigation, no form, no error.
    cy.url().should('include', ROUTE)
    cy.contains(/TB Treatment Services/i).should('exist')
    cy.get('form').should('not.exist')
  })

  it('should offer the record actions on an attended patient, none of them implemented', () => {
    switchTab(ATTENDED_TAB)
    openFirstRowMenu()

    actionMenuItems().then((labels) => {
      ;['View Details', 'Edit Patient', 'Patient Details'].forEach((action) =>
        expect(labels).to.include(action))
    })

    cy.get(ACTION_MENU).contains('button', 'View Details').click({ force: true })
    cy.wait(3000)

    cy.url().should('include', ROUTE)
    cy.get('form').should('not.exist')
  })
})
