import { login } from '../../../support/modules/login'
import {
  HIV_ROUTES,
  openFirstRowActions,
  openHivForm,
  openHivPage,
  rowActionLabels,
} from '../../../support/modules/hiv'
import {
  assertEveryDateFilled,
  assertNothingLeftEmpty,
  expandAllSections,
  fillEverything,
  sectionTitles,
} from '../../../support/modules/form-fill'

// PrEP/PEP services: all five forms, opened from the worklist at
// /pbh/hiv/prep-services.
//
// The worklist opens on "Patients Registered for PrEP", and that queue is the one
// whose rows offer every form, so no tab switch is needed.
//
// Like the other HIV services on this build, none of these persist anything -
// handleSubmit is a console.log - so each form is asserted on rendering and on
// every field being answerable.
//
// The screening form is the largest form in the application: six sections and 57
// dropdowns, which is why it is filled by sweep rather than field by field.

// [test name, row action, url fragment, a heading the form must show]
const FORMS = [
  ['screening and eligibility', 'PrEP/PEP Screening and Eligibility', '/prep-services/eligibility', 'PrEP Basic Information'],
  ['initiation', 'PrEP/PEP Initiation', '/prep-services/initiation', 'PrEP/PEP Initial Visit'],
  ['discontinuations and interruptions', 'Discontinuations & Interruptions', '/prep-services/discontinuation', 'PrEP Interruptions'],
  ['follow-up', 'PrEP/PEP Follow-up', '/prep-services/followup', /Follow-up Form/i],
  ['PEP completion', 'PEP Completion Form', '/prep-services/pep-completion', /PEP Completion|Index Client/i],
]

describe('HIV - PrEP forms', () => {
  beforeEach(() => {
    cy.session('hiv-prep', () => {
      login()
    })
  })

  it('should offer every PrEP form on a registered patient', () => {
    openHivPage(HIV_ROUTES.prep, /PrEP/i)

    cy.contains('button', 'Patients in Waiting').should('exist')
    cy.contains('button', 'Patients Registered for PrEP').should('exist')

    openFirstRowActions()
    rowActionLabels().then((labels) => {
      FORMS.forEach(([, action]) => expect(labels).to.include(action))
    })
  })

  FORMS.forEach(([name, action, url, heading]) => {
    describe(name, () => {
      beforeEach(() => {
        openHivForm({
          route: HIV_ROUTES.prep,
          heading: /PrEP/i,
          action,
          expectUrl: url,
          expectText: heading,
        })
      })

      it(`should render the ${name} form on the selected patient`, () => {
        cy.contains(/Hospital No/i).should('exist')
        cy.contains('button', 'Save').should('exist')
      })

      it(`should fill every field on the ${name} form`, () => {
        fillEverything()
        assertNothingLeftEmpty()
        assertEveryDateFilled()
      })

      it(`should save the ${name} form`, () => {
        fillEverything()

        cy.contains('button', 'Save').should('not.be.disabled').click({ force: true })
        cy.wait(3000)

        cy.get('body').should('not.contain', 'Page not found')
        cy.get('body').should(($body) => {
          expect(($body.text() || '').replace(/\s+/g, ' ')).to.not.match(/is required/i)
        })
      })
    })
  })

  describe('screening and eligibility specifics', () => {
    beforeEach(() => {
      openHivForm({
        route: HIV_ROUTES.prep,
        heading: /PrEP/i,
        action: 'PrEP/PEP Screening and Eligibility',
        expectUrl: '/prep-services/eligibility',
        expectText: 'PrEP Basic Information',
      })
    })

    it('should render all six screening sections', () => {
      sectionTitles().then((titles) => {
        const joined = titles.join(' | ')
        expect(joined).to.match(/PrEP Basic Information/)
        expect(joined).to.match(/Pre-Test Counselling/)
        expect(joined).to.match(/HIV Testing/)
        expect(joined).to.match(/PrEP Eligibility Scoring/)
        expect(joined).to.match(/Consideration for Injectibles/)
        expect(joined).to.match(/PrEP Initiation/)
        expect(titles.length, 'six sections').to.equal(6)
      })
    })

    it('should offer the whole risk assessment as answerable dropdowns', () => {
      // Sections have to be expanded first - their content is not rendered while
      // collapsed, so counting before that only sees the first section's fields.
      expandAllSections()

      cy.get('select').then(($selects) => {
        const enabled = [...$selects].filter((select) => !select.disabled)
        const withoutOptions = enabled
          .filter((select) => [...select.options].filter((option) => option.value).length === 0)
          .map((select) => select.name)

        cy.log(`${enabled.length} enabled dropdowns on the screening form`)

        // An empty dropdown is unanswerable, and on a scored risk assessment that
        // silently changes the outcome rather than showing an error.
        expect(withoutOptions, 'no dropdown with an empty option list').to.deep.equal([])
        expect(enabled.length, 'the screening form is dropdown-driven end to end').to.be.greaterThan(40)
      })
    })
  })
})
