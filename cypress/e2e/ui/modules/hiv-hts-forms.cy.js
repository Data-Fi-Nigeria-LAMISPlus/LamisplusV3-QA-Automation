import { login } from '../../../support/modules/login'
import { HIV_ROUTES, openHivForm, openHivPage, openFirstRowActions, rowActionLabels } from '../../../support/modules/hiv'
import {
  assertNothingLeftEmpty,
  fillEverything,
  sectionTitles,
} from '../../../support/modules/form-fill'

// HIV Testing Services: the HTS form and the Index Contact Testing (ICT) form,
// both opened from the HTS worklist at /pbh/hiv/hts.
//
// Neither form persists anything on this build: their save handler is a toast plus
// a console.log, with no request of any kind. So these tests assert what is
// actually assertable - that the form renders, that every field can be answered,
// and that saving reports success - and no more. When the forms are wired to an
// API, add response assertions here.
//
// The HTS form saves per section (four Save buttons, one each), which the ICT form
// does not - it has a single Save.

describe('HIV - HTS forms', () => {
  beforeEach(() => {
    cy.session('hiv-hts', () => {
      login()
    })
  })

  it('should offer both testing forms on a waiting patient', () => {
    openHivPage(HIV_ROUTES.hts, /HTS Services/i)

    cy.contains('button', 'Patients in Waiting').should('exist')
    cy.contains('button', 'HTS Patients').should('exist')

    openFirstRowActions()
    rowActionLabels().then((labels) => {
      expect(labels).to.include('HTS Form')
      expect(labels).to.include('ICT Form')
    })
  })

  describe('HTS form', () => {
    beforeEach(() => {
      openHivForm({
        route: HIV_ROUTES.hts,
        heading: /HTS Services/i,
        action: 'HTS Form',
        expectUrl: '/hiv/hts/form',
        expectText: 'Basic Information',
      })
    })

    it('should render its four sections for the selected client', () => {
      sectionTitles().then((titles) => {
        expect(titles.join(' | ')).to.match(/Basic Information/)
        expect(titles.join(' | ')).to.match(/Pre-Test Counselling/)
        expect(titles.join(' | ')).to.match(/Diagnostic Testing/)
        expect(titles.join(' | ')).to.match(/Post Test Counselling/)
      })

      // Opened on a client, and the visit is pre-dated to today.
      cy.contains(/Hospital No/i).should('exist')
      cy.get('input[readonly]').first().invoke('val').should('match', /\d{4}-\d{2}-\d{2}/)

      // Client Code is derived, not entered.
      cy.get('input[name="clientCode"]').should('be.disabled')
    })

    it('should score the risk assessment from the answers given', () => {
      // The four score boxes are read-only outputs of the pre-test answers, so
      // they should stop being blank once the section is answered. Asserted on
      // value rather than visibility: they sit in a panel the layout hides at the
      // test viewport, which says nothing about whether the scoring works.
      fillEverything()

      ;['knowledgeAssessmentScore', 'personalRiskScore', 'tbScreeningScore', 'stiScreeningScore'].forEach((name) => {
        cy.get(`input[name="${name}"]`).invoke('val').should('not.be.empty')
      })
    })

    it('should fill every field on the form', () => {
      fillEverything()
      assertNothingLeftEmpty()
    })

    it('should save each section', () => {
      fillEverything()

      // One Save per section; each reports on its own.
      cy.get('button').filter((_i, button) => /^Save$/.test((button.innerText || '').trim())).then(($saves) => {
        expect($saves.length, 'a Save per section').to.be.greaterThan(1)
      })

      cy.get('button')
        .filter((_i, button) => /^Save$/.test((button.innerText || '').trim()))
        .each(($save) => {
          cy.wrap($save).click({ force: true })
          cy.wait(600)
        })

      // Nothing is posted, so success is only ever a toast.
      cy.contains(/saved successfully/i, { timeout: 15000 }).should('exist')
      cy.get('body').should('not.contain', 'Page not found')
      cy.screenshot('hiv-hts-form-filled')
    })
  })

  describe('ICT form', () => {
    beforeEach(() => {
      openHivForm({
        route: HIV_ROUTES.hts,
        heading: /HTS Services/i,
        action: 'ICT Form',
        expectUrl: '/hiv/hts/ict-form',
        expectText: 'Index Client Details',
      })
    })

    it('should carry the index client over read-only', () => {
      // The index client's identity comes from the worklist row and cannot be
      // edited here - only the testing details below it are entered.
      ;['state', 'lga', 'facilityName', 'clientNames', 'sex', 'indexClientId', 'age'].forEach((name) => {
        cy.get(`input[name="${name}"]`).should('be.disabled')
      })
    })

    it('should fill every field on the form', () => {
      fillEverything()
      assertNothingLeftEmpty()
    })

    it('should save', () => {
      fillEverything()

      cy.contains('button', 'Save').should('not.be.disabled').click({ force: true })

      cy.contains(/saved successfully/i, { timeout: 15000 }).should('exist')
      cy.get('body').should('not.contain', 'Page not found')
      cy.screenshot('hiv-ict-form-filled')
    })
  })
})
