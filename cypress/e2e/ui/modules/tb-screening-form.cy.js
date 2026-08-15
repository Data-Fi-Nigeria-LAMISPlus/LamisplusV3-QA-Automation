import { login } from '../../../support/modules/login'
import {
  ACTION_MENU,
  actionMenuItems,
  openFirstRowMenu,
  openPage,
  switchTab,
} from '../../../support/modules/app-nav'
import {
  assertNothingLeftEmpty,
  expandAllSections,
  fillEverything,
  sectionTitles,
} from '../../../support/modules/form-fill'

// TB Screening: the screening form, opened from the worklist at /pbh/tb/screening.
//
// The form is two sections - the visit date, then eight yes/no symptom indicators
// and the presumptive-TB outcome - and it persists nothing: handleSubmit is a
// console.log with a "// TODO: implement API call" above it, followed by
// navigate(-1). So the only observable effect of saving is landing back on the
// worklist, which is what the save test asserts.
//
// Deployed facts worth knowing, from qa.lamisplus.org:
//   - the worklist fetches, showing "Loading..." for a few seconds before its
//     table exists, so waits are on the table rather than on the page heading
//   - the form's route carries no patient id (/pbh/tb/screening/form); the patient
//     comes from the row action, so a direct visit is not equivalent
//   - the waiting queue offers "Screen Patient"; the attended queue offers View
//     Details / Edit Patient / Patient Details instead

const ROUTE = '/pbh/tb/screening'
const WAITING_TAB = 'Patient in Waiting'
const ATTENDED_TAB = 'Attended To'

const SYMPTOMS = [
  'cough',
  'feverFor2WeeksOrMore',
  'unexplainedWeightLoss',
  'failureToThrive',
  'drenchingNightSweats',
  'swellingOnNeck',
  'chestXraySuggestive',
  'presumptiveTb',
]

// This worklist fetches its rows, and the fetch does not always land: under load
// the page can sit on "Loading..." past openPage's own budget, or settle with an
// empty table. Both recover on a reload, neither recovers by waiting, so settle on
// a definite state - rows or an empty table - and reload when it is the empty one.
const openWorklist = (attempt = 1) => {
  openPage(ROUTE, /TB Screening Services|Loading/i)

  cy.get('body', { timeout: 45000 }).should(($body) => {
    const settled = $body.find('tbody tr').length > 0 || /No data available/i.test($body.text() || '')
    expect(settled, 'worklist finished loading').to.equal(true)
  })

  cy.get('body').then(($body) => {
    if ($body.find('tbody tr').length) return

    if (attempt >= 3) {
      throw new Error('TB screening worklist never returned any rows')
    }
    cy.log(`worklist came back empty, retry ${attempt + 1}/3`)
    cy.wait(2000)
    openWorklist(attempt + 1)
  })
}

const openScreeningForm = () => {
  openWorklist()
  openFirstRowMenu()
  cy.get(ACTION_MENU).contains('button', 'Screen Patient').click({ force: true })

  cy.url({ timeout: 30000 }).should('include', '/tb/screening/form')
  cy.contains('Visit Information', { timeout: 30000 }).should('exist')
  cy.wait(1500)
}

describe('TB - Screening', () => {
  beforeEach(() => {
    cy.session('pbh-tb-screening', () => {
      login()
    })
  })

  it('should render the waiting queue with its expected columns', () => {
    openWorklist()

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Patient ID', 'Name', 'Sex', 'Age', 'Screening Date', 'Actions']
        .forEach((column) => expect(actual).to.include(column))
    })
  })

  it('should add the screening outcome columns on the attended queue', () => {
    openWorklist()

    cy.contains('button', WAITING_TAB).should('exist')
    cy.contains('button', ATTENDED_TAB).should('exist')

    switchTab(ATTENDED_TAB)
    cy.get('tbody tr', { timeout: 30000 }).should('have.length.greaterThan', 0)

    cy.get('thead th').then(($headers) => {
      const actual = [...$headers].map((th) => (th.innerText || '').trim())
      ;['Screening Status', 'HIV Status', 'Referral Status'].forEach((column) =>
        expect(actual).to.include(column))
    })
  })

  it('should offer screening on a waiting patient and the record actions on an attended one', () => {
    openWorklist()

    openFirstRowMenu()
    actionMenuItems().then((labels) => {
      expect(labels, 'waiting queue offers screening').to.include('Screen Patient')
    })

    switchTab(ATTENDED_TAB)
    cy.get('tbody tr', { timeout: 30000 }).should('have.length.greaterThan', 0)

    openFirstRowMenu()
    actionMenuItems().then((labels) => {
      ;['View Details', 'Edit Patient', 'Patient Details'].forEach((action) =>
        expect(labels).to.include(action))
    })
  })

  describe('screening form', () => {
    beforeEach(() => {
      openScreeningForm()
    })

    it('should render both sections on the selected patient', () => {
      sectionTitles().then((titles) => {
        const joined = titles.join(' | ')
        expect(joined).to.match(/Visit Information/)
        expect(joined).to.match(/TB Symptom Assessment/)
      })

      // The patient comes from the worklist row, shown in the header card.
      cy.contains(/Hospital No/i).should('exist')
      cy.contains('button', 'Save').should('exist')
      cy.contains('button', 'Cancel').should('exist')
    })

    it('should ask for the visit date rather than assume today', () => {
      // Unlike the HTS form, this one arrives with an empty date - so it has to be
      // answered, and the sweep is what proves it can be.
      cy.get('input[readonly]').first().invoke('val').should('not.match', /\d{4}-\d{2}-\d{2}/)
    })

    it('should carry the patient over read-only', () => {
      expandAllSections()

      // Name, age and sex come from the worklist row and cannot be edited here -
      // only the visit date and the symptoms are entered.
      ;['patientName', 'age', 'sex'].forEach((name) => {
        cy.get(`input[name="${name}"]`).should('be.disabled').invoke('val').should('not.be.empty')
      })

      // And they describe the same patient as the header card, rather than being
      // left over from whichever row was opened before.
      cy.get('input[name="patientName"]').invoke('val').then((patientName) => {
        cy.contains(String(patientName)).should('exist')
      })
    })

    it('should offer every symptom indicator as a yes/no answer', () => {
      expandAllSections()

      SYMPTOMS.forEach((name) => {
        cy.get(`select[name="${name}"]`).should('not.be.disabled').then(($select) => {
          const options = [...$select[0].options].map((option) => option.text)
          expect(options, `${name} offers yes and no`).to.include.members(['Yes', 'No'])
        })
      })
    })

    it('should ask how long the cough has lasted once cough is answered', () => {
      expandAllSections()

      cy.get('select[name="durationOfCough"]').should('not.exist')

      cy.get('select[name="cough"]').select('yes', { force: true })

      // A required follow-up, so leaving it unanswered silently blocks the save.
      cy.get('select[name="durationOfCough"]').should('exist').and('have.attr', 'required')
    })

    it('should fill every field on the form', () => {
      // Dates are skipped: choosing one crashes the form outright, which the test
      // below records. Everything else is answerable.
      fillEverything({ skipDates: true })

      assertNothingLeftEmpty()

      // Every symptom really answered, not just present.
      SYMPTOMS.forEach((name) => {
        cy.get(`select[name="${name}"]`).invoke('val').should('not.be.empty')
      })

      cy.screenshot('tb-screening-form-filled')
    })

    // Records a defect, and the reason the fill above skips dates.
    //
    // Date of Visit is the form's first and only date, labelled required. Choosing
    // any day from its calendar tears the page down to the host's error boundary -
    // "Something went wrong. This section failed to load." - losing every answer
    // already given. So a TB screening cannot be recorded with a visit date at all.
    //
    // All eight symptom answers are fine; only the date does this. When it is fixed
    // this test will fail: drop it and take skipDates off the fill above.
    it('should crash the form when a visit date is chosen (app defect)', () => {
      cy.get('button[aria-label="Choose date"]').first().click({ force: true })
      cy.get('[role="dialog"]', { timeout: 15000 }).should('be.visible')

      cy.get('[role="dialog"]').find('button[aria-current="date"]:not([disabled])').first().click({ force: true })
      cy.wait(2000)

      cy.contains(/Something went wrong|failed to load/i, { timeout: 15000 }).should('exist')
      cy.get('select[name="cough"]').should('not.exist')
      cy.screenshot('tb-screening-date-crash')
    })

    it('should return to the worklist when saved', () => {
      fillEverything({ skipDates: true })

      cy.contains('button', 'Save').should('not.be.disabled').click({ force: true })
      cy.wait(3000)

      // Nothing is posted - the handler is a console.log under a "TODO: implement
      // API call" - so going back to the worklist is the whole of the observable
      // behaviour. It submits without a visit date because the date input is
      // readonly, and readonly fields are exempt from native validation.
      cy.url({ timeout: 20000 }).should('include', ROUTE)
      cy.url().should('not.include', '/form')
      cy.contains(/TB Screening Services/i).should('exist')
    })

    it('should abandon the screening when cancelled', () => {
      cy.contains('button', 'Cancel').click({ force: true })

      cy.url({ timeout: 20000 }).should('include', ROUTE)
      cy.url().should('not.include', '/form')
    })
  })
})
