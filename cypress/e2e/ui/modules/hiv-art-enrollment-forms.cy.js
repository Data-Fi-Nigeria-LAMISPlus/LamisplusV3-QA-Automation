import { login } from '../../../support/modules/login'
import {
  HIV_ROUTES,
  openFirstRowActions,
  openHivForm,
  openHivPage,
  rowActionLabels,
  switchWorklistTab,
} from '../../../support/modules/hiv'
import {
  assertEveryDateFilled,
  assertNothingLeftEmpty,
  fillEverything,
  sectionTitles,
} from '../../../support/modules/form-fill'

// ART Enrollment: the enrollment form plus the six follow-on forms, all opened
// from the worklist at /pbh/hiv/art-enrollment.
//
// Which forms a row offers depends on its queue: a waiting patient offers only
// "Enroll Patient", while an enrolled one offers the clinical evaluation, adherence
// preparation, care card, care and support, enhanced adherence and tracking forms.
//
// None of these persist anything on this build - handleSubmit is a console.log with
// no request and not even a toast - so each form is asserted on what it renders and
// on every field being answerable. Add response assertions when they are wired up.

const WAITING_TAB = 'Patient in waiting'
const ENROLLED_TAB = 'ART Enrolled Patients'

// [test name, row action, url fragment, a heading the form must show]
const FOLLOW_ON_FORMS = [
  ['initial clinical evaluation', 'Initial Clinical Evaluation', '/initial-clinical-evaluation', 'Symptom Review'],
  ['adherence preparation', 'ART Adherence Preparation', '/adherence-preparation', 'Adherence Preparation'],
  ['care card', 'ART Care Card/Follow-Up', '/care-card', 'Current Service Status'],
  ['care and support', 'Care and Support/PHDP Services', '/care-support', 'Services'],
  ['enhanced adherence counselling', 'Enhanced Adherence Counselling', '/enhanced-adherence', 'Enhanced Adherence Counselling'],
  ['tracking and discontinuation', 'ART Tracking and Discontinuation', '/tracking-discontinuation', 'Record Tracking Attempt'],
]

const openEnrolledForm = (action, url, heading) =>
  openHivForm({
    route: HIV_ROUTES.artEnrollment,
    heading: /ART Enrollment Services/i,
    tab: ENROLLED_TAB,
    action,
    expectUrl: url,
    expectText: heading,
  })

describe('HIV - ART Enrollment forms', () => {
  beforeEach(() => {
    cy.session('hiv-art', () => {
      login()
    })
  })

  it('should offer enrollment on a waiting patient and the care forms on an enrolled one', () => {
    openHivPage(HIV_ROUTES.artEnrollment, /ART Enrollment Services/i)

    openFirstRowActions()
    rowActionLabels().then((labels) => {
      expect(labels, 'waiting queue offers enrollment').to.include('Enroll Patient')
    })

    switchWorklistTab(ENROLLED_TAB)
    openFirstRowActions()
    rowActionLabels().then((labels) => {
      FOLLOW_ON_FORMS.forEach(([, action]) => expect(labels).to.include(action))
    })
  })

  describe('enrollment form', () => {
    beforeEach(() => {
      openHivForm({
        route: HIV_ROUTES.artEnrollment,
        heading: /ART Enrollment Services/i,
        tab: WAITING_TAB,
        action: 'Enroll Patient',
        expectUrl: '/art-enrollment/enroll',
        expectText: 'ART Enrollment And Commencement Details',
      })
    })

    it('should render its three sections on the selected patient', () => {
      sectionTitles().then((titles) => {
        const joined = titles.join(' | ')
        expect(joined).to.match(/ART Enrollment And Commencement Details/)
        expect(joined).to.match(/ART Confirmatory Details/)
        expect(joined).to.match(/ART Pharmacy Orders/)
      })

      cy.contains(/Hospital No/i).should('exist')
      cy.contains('button', 'Add Drug Order').should('exist')
    })

    it('should derive the CD4, adherence and refill fields rather than accept them', () => {
      ;['cd4AtStartOfArt', 'cd4Lfa', 'dateInitialAdherenceCounsellingCompleted', 'quantityPrescribed', 'nextRefillDate']
        .forEach((name) => cy.get(`input[name="${name}"]`).should('be.disabled'))
    })

    it('should fill every field on the form', () => {
      fillEverything()
      assertNothingLeftEmpty()
      assertEveryDateFilled()
      cy.screenshot('hiv-art-enrollment-filled')
    })

    it('should save', () => {
      fillEverything()

      cy.contains('button', 'Save').should('not.be.disabled').click({ force: true })
      cy.wait(3000)

      // Nothing is posted, so the only honest assertion is that the form did not
      // break and raised no validation complaint.
      cy.get('body').should('not.contain', 'Page not found')
      cy.get('body').should(($body) => {
        expect(($body.text() || '').replace(/\s+/g, ' ')).to.not.match(/is required/i)
      })
    })
  })

  FOLLOW_ON_FORMS.forEach(([name, action, url, heading]) => {
    describe(name, () => {
      beforeEach(() => {
        openEnrolledForm(action, url, heading)
      })

      it(`should render the ${name} form`, () => {
        cy.contains(heading).should('exist')
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
})
