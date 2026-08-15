import { login } from '../../../support/modules/login'
import { ACTION_MENU, actionMenuItems, openFirstRowMenu } from '../../../support/modules/app-nav'
import {
  IMMUNIZATION_POST,
  NEW_IMMUNIZATION,
  ensureImmunizationPatient,
  ensureRoutineCard,
  modalContainer,
  openCardRowAction,
  openFullCard,
  openImmunizationDashboard,
  openImmunizationWorklist,
  startNewImmunization,
  submitModal,
} from '../../../support/modules/immunization'
import { assertNothingLeftEmpty, fillEverything } from '../../../support/modules/form-fill'

// Routine Immunization (/pbh/immunization) - the worklist, the patient dashboard's
// immunization tab, the RI card and the three immunization forms.
//
// This is the one public health module on this build where saving really means
// something: every form posts to a live endpoint under /plugin/pbh/api/immunizations
// and the card writes through /plugin/ehr/api/v1/patient-drug-administration. So
// unlike HTS, ART, PrEP and TB screening - whose handlers are console.log - these
// tests assert the response, not just that the UI did not fall over.
//
// One patient carries the whole file. The queue is a real service-point posting
// queue, so the setup uses whoever is already waiting and only registers a child
// (routine immunization is an age-based schedule) when nobody is.

describe('Immunization', () => {
  let hospitalNumber

  before(() => {
    cy.session('pbh-immunization', () => {
      login()
    })
    ensureImmunizationPatient().then((identifier) => {
      hospitalNumber = identifier
    })
  })

  beforeEach(() => {
    cy.session('pbh-immunization', () => {
      login()
    })
  })

  describe('worklist', () => {
    beforeEach(() => {
      openImmunizationWorklist()
    })

    it('should render both queues and the expected columns', () => {
      cy.contains('button', 'Patients in Waiting').should('exist')
      cy.contains('button', 'Patients Attended To').should('exist')

      cy.get('thead th').then(($headers) => {
        const actual = [...$headers].map((th) => (th.innerText || '').trim())
        ;['Hospital No', 'Patient Name', 'Sex', 'Age', 'Actions'].forEach((column) =>
          expect(actual).to.include(column))
      })
    })

    it('should offer the patient dashboard on a waiting patient', () => {
      openFirstRowMenu()
      actionMenuItems().then((labels) => {
        expect(labels, 'the worklist opens the dashboard and nothing else').to.deep.equal(['Dashboard'])
      })
    })
  })

  describe('patient dashboard', () => {
    beforeEach(() => {
      openImmunizationDashboard(hospitalNumber)
    })

    it('should open the shared patient dashboard on its immunization tab', () => {
      // The plugin still declares /pbh/immunization/patient-dashboard, but the
      // deployed worklist sends you to the shared dashboard instead.
      cy.url().should('include', '/patients/dashboard')
      cy.contains(hospitalNumber).should('exist')

      ;['Create RI Card', 'New Immunization', 'Routine Immunizations', 'Immunization History']
        .forEach((control) => cy.contains('button', control).should('exist'))
    })

    it('should offer all three immunisations on the New Immunization menu', () => {
      cy.contains('button', 'New Immunization').click({ force: true })

      Object.values(NEW_IMMUNIZATION).forEach((label) => {
        cy.contains('button', label).should('exist')
      })
    })

    // Records a gap: the tab exists but has nothing behind it yet. When AEFI is
    // built this fails - replace it with fill-and-save tests.
    it('should have no adverse events form yet', () => {
      cy.contains('button', 'Adverse Events (AEFI)').click({ force: true })
      cy.wait(2000)

      cy.contains(/content coming soon/i).should('exist')
      cy.get('form').should('not.exist')
    })
  })

  describe('routine immunization card', () => {
    beforeEach(() => {
      openImmunizationDashboard(hospitalNumber)
      ensureRoutineCard()
    })

    it('should build the schedule with its expected columns', () => {
      cy.get('thead th').then(($headers) => {
        const actual = [...$headers].map((th) => (th.innerText || '').trim())
        ;['Vaccine', 'Route / Site', 'Status', 'Scheduled Date', 'Date Administered', 'Reason Missed', 'Administered By']
          .forEach((column) => expect(actual).to.include(column))
      })

      // A real schedule, not an empty card - BCG through the OPV/PCV series.
      cy.get('tbody tr').should('have.length.greaterThan', 1)
      cy.contains('BCG').should('exist')
      cy.screenshot('immunization-routine-card')
    })

    it('should offer view, administer and missed-dose actions on a scheduled vaccine', () => {
      openFirstRowMenu()
      actionMenuItems().then((labels) => {
        ;['View Vaccination Details', 'Mark as Administered', 'Enter reason for missed vaccination']
          .forEach((action) => expect(labels).to.include(action))
      })
    })

    it('should record a dose as administered', () => {
      // Method-specific: the card fetches itself from the same path, and a bare url
      // match would be satisfied by that GET instead of the write.
      cy.intercept({ method: 'PUT', url: /patient-drug-administration/ }).as('administer')

      openFullCard()
      openCardRowAction('Mark as Administered')

      // The modal asks for the session, the date and where the vaccine was given.
      modalContainer().should('be.visible')
      fillEverything()
      submitModal()

      // The write is the assertion. The success toast is not: it is dismissed on a
      // timer, so whether it is still on screen by the time the request resolves is
      // a race, and failing on that would say "administering is broken" when it is
      // not.
      cy.wait('@administer', { timeout: 30000 }).then(({ request, response }) => {
        const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
        const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
        expect(response?.statusCode, `administering rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`)
          .to.be.oneOf([200, 201])
        expect(sent, 'recorded as administered').to.match(/administered/i)
      })
    })

    it('should record why a dose was missed', () => {
      cy.intercept({ method: 'PUT', url: /patient-drug-administration/ }).as('missed')

      openFullCard()
      openCardRowAction('Enter reason for missed vaccination')

      // Dates included: the API rejects a missed dose with no dateMissed, with
      // "Status must be either administered or missed (hint: also check dateMissed
      // and missedRecordedBy)".
      modalContainer().should('be.visible')
      fillEverything()
      submitModal()

      cy.wait('@missed', { timeout: 30000 }).then(({ request, response }) => {
        const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
        const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
        expect(response?.statusCode, `missed-dose rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`)
          .to.be.oneOf([200, 201])
        expect(sent, 'recorded as missed').to.match(/missed/i)
      })
    })
  })

  describe('tetanus immunization form', () => {
    beforeEach(() => {
      openImmunizationDashboard(hospitalNumber)
      startNewImmunization(NEW_IMMUNIZATION.tetanus)
    })

    it('should render on the selected patient', () => {
      // A sub-view of the dashboard, not a page of its own - see startNewImmunization.
      cy.contains('Tetanus Immunization').should('exist')
      cy.contains(hospitalNumber).should('exist')
      cy.contains('button', 'Save').should('exist')

      // The vaccination is dated today without being asked for.
      cy.get('input[readonly]').first().invoke('val').should('match', /\d{4}-\d{2}-\d{2}/)
    })

    // The only immunization form with submit-time validation, and it names the
    // field it is missing.
    it('should refuse to save without the vaccine type', () => {
      cy.intercept({ method: 'POST', url: IMMUNIZATION_POST }).as('tetanus')

      cy.contains('button', 'Save').click({ force: true })

      cy.contains(/Type of Tetanus Vaccine is required/i, { timeout: 15000 }).should('exist')
      cy.get('@tetanus.all').should('have.length', 0)
    })

    it('should fill every field and post the immunisation', () => {
      cy.intercept({ method: 'POST', url: IMMUNIZATION_POST }).as('tetanus')

      fillEverything()
      assertNothingLeftEmpty()

      cy.contains('button', 'Save').click({ force: true })

      cy.wait('@tetanus', { timeout: 30000 }).then(({ request, response }) => {
        const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
        const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
        expect(request?.url, 'posted to the tetanus endpoint').to.match(/immunizations\/tetanus/)
        expect(
          response?.statusCode,
          `tetanus immunisation rejected.\nresponse: ${body}\nrequest: ${sent}`
        ).to.be.oneOf([200, 201])
      })
      cy.screenshot('immunization-tetanus-saved')
    })
  })

  describe('covid-19 immunization form', () => {
    beforeEach(() => {
      openImmunizationDashboard(hospitalNumber)
      startNewImmunization(NEW_IMMUNIZATION.covid)
    })

    it('should render both of its sections on the selected patient', () => {
      cy.contains('Covid-19 Immunization').should('exist')
      cy.contains('Vaccine Details').should('exist')
      cy.contains('button', 'Save').should('exist')
    })

    it('should fill every field and post the immunisation', () => {
      cy.intercept({ method: 'POST', url: IMMUNIZATION_POST }).as('covid')

      fillEverything()
      assertNothingLeftEmpty()

      cy.contains('button', 'Save').click({ force: true })

      cy.wait('@covid', { timeout: 30000 }).then(({ request, response }) => {
        const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
        const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
        expect(request?.url, 'posted to the covid19 endpoint').to.match(/immunizations\/covid19/)
        expect(
          response?.statusCode,
          `covid-19 immunisation rejected.\nresponse: ${body}\nrequest: ${sent}`
        ).to.be.oneOf([200, 201])
      })
      cy.screenshot('immunization-covid-saved')
    })
  })

  // Records a gap rather than a feature.
  //
  // The plugin routes a standalone routine dose form at /pbh/immunization/routine -
  // session type, vaccine, route, site, dosage - and it renders if visited
  // directly, but with no patient attached. Nothing in the UI opens it: the
  // dashboard's row actions and the full card's row actions all lead back into the
  // card, and "View Vaccination Details" is offered only by the summary table,
  // where it opens the card too.
  //
  // Doses are therefore recorded through the card's "Mark as Administered" modal,
  // which is covered above and does post. If a route to this form is added, this
  // test fails - replace it with fill-and-save tests against POST
  // /plugin/pbh/api/immunizations/routine.
  describe('routine dose form', () => {
    beforeEach(() => {
      openImmunizationDashboard(hospitalNumber)
      ensureRoutineCard()
    })

    it('should not be reachable from the card - doses are recorded on the card itself', () => {
      openCardRowAction('View Vaccination Details')

      // Still inside the dashboard, and not on the dose form.
      cy.url().should('include', '/patients/dashboard')
      cy.contains('Immunization Details').should('not.exist')
      cy.get('select[name="sessionType"]').should('not.exist')
    })
  })
})
