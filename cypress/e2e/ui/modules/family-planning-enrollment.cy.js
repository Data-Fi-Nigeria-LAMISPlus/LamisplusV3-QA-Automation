import { login } from '../../../support/modules/login'
import {
  FP_CREATE_URL,
  addFamilyPlanningMethod,
  chooseByName,
  fillEnrollmentForm,
  openEnrollmentForm,
  registerFamilyPlanningClient,
} from '../../../support/modules/family-planning'

// The family planning enrollment form (/pbh/family-planning/enroll).
//
// One client is registered and posted to the FAMILY_PLANNING service point for
// the whole file, because the worklist this form opens from starts empty on a
// fresh environment and making a patient costs a full registration. Every test
// then re-opens the form on her.
//
// The form cannot currently be saved on this build - see the last two tests. That
// is a defect in the app, not in this spec: the form makes "Do you want to have
// more children?" a required field, and answering it is what the API refuses. The
// fill is therefore asserted on the form's own state, and the save behaviour is
// pinned down separately so a fix is noticed.

describe('Family Planning enrollment', () => {
  let hospitalNumber

  before(() => {
    cy.session('pbh-fp-enrollment', () => {
      login()
    })

    // --env fpHospitalNumber=HOSP-... reuses a client already waiting at the
    // service point, which turns a re-run from ~1 minute of registration into
    // seconds. Unset, the run makes its own.
    hospitalNumber = Cypress.env('fpHospitalNumber') || registerFamilyPlanningClient()
  })

  beforeEach(() => {
    cy.session('pbh-fp-enrollment', () => {
      login()
    })
    openEnrollmentForm(hospitalNumber)
  })

  it('should render all four enrollment sections on the client', () => {
    ;['Reproductive History', 'Family Planning Options', 'Initial Medical Examination', 'Select Family Planning Method']
      .forEach((section) => cy.contains(section).should('exist'))

    // The form is opened for a specific client, not a blank one.
    cy.contains(hospitalNumber).should('exist')
    cy.contains('button', 'Save').should('exist')

    // Administered By is filled in from the signed-in user and left read-only.
    cy.get('input[name="administeredBy"]').should('be.disabled').invoke('val').should('not.be.empty')
  })

  it('should keep the referral service locked until the client is referred', () => {
    cy.get('select[name="serviceReferredFor"]').should('be.disabled')

    chooseByName('patientReferred', /^Yes$/)
    cy.get('select[name="serviceReferredFor"]').should('not.be.disabled')

    chooseByName('patientReferred', /^No$/)
    cy.get('select[name="serviceReferredFor"]').should('be.disabled')
  })

  it('should ask for the prior contraceptive details only when one was used', () => {
    cy.get('select[name="mostRecentContraceptiveUsed"]').should('not.exist')

    chooseByName('contraceptiveUsedPrior', /^Yes$/)

    cy.get('select[name="mostRecentContraceptiveUsed"]').should('exist')
    cy.get('select[name="methodOfPriorContraceptive"]').should('exist')
    cy.get('select[name="sourceOfPriorContraceptive"]').should('exist')
  })

  // Another codeset-versus-literal defect, and the reason a complicated pregnancy
  // cannot be described: the note is gated on resultOfLastPregnancy ===
  // 'Complicated', but the option's value is a codeset uuid, so the comparison can
  // never hold. Flip to .should('exist') when the app is fixed.
  it('should never reveal the complication note - the codeset value cannot match (app defect)', () => {
    cy.get('textarea[name="specifyComplications"]').should('not.exist')

    chooseByName('resultOfLastPregnancy', /^Complicated$/)
    cy.get('select[name="resultOfLastPregnancy"]')
      .invoke('val')
      .should('match', /^[0-9a-f]{8}-[0-9a-f]{4}-/)

    cy.get('textarea[name="specifyComplications"]').should('not.exist')
  })

  it('should ask for the method to be chosen before it can be added', () => {
    cy.contains('button', 'Add Method').should('be.disabled')

    // A method on its own is not enough - the visit type gates it too.
    chooseByName('fpMethod', /^Condom$/)
    cy.contains('button', 'Add Method').should('be.disabled')

    chooseByName('visitType', /new acceptor/i)
    cy.contains('button', 'Add Method').should('not.be.disabled')
  })

  it('should add a family planning method', () => {
    addFamilyPlanningMethod({ method: /^Oral Pills$/, visitType: /new acceptor/i })

    // Added methods become chips and the picker resets for the next one.
    cy.contains('Oral Pills').should('exist')
    cy.get('select[name="fpMethod"]').should('have.value', '')
  })

  it('should fill every section of the enrollment', () => {
    fillEnrollmentForm()

    // Section 1 - typed and chosen answers, plus the dates, which are read-only
    // MUI inputs with no name to address them by.
    cy.get('select[name="clientReligion"]').should('have.value', 'Christianity')
    cy.get('input[name="breastfeedingStatus"]').should('have.value', 'Not breastfeeding')
    cy.get('input[name="menstrualCycleDuration"]').should('have.value', '28')
    cy.get('select[name="numberOfPregnancies"]').invoke('val').should('not.be.empty')
    cy.get('input[readonly]').then(($dates) => {
      const filled = [...$dates].filter((input) => /\d{4}-\d{2}-\d{2}/.test(input.value))
      expect(filled.length, 'dates taken from the calendar').to.be.greaterThan(3)
    })

    // Sections 2 to 4.
    cy.get('select[name="counselledOnFP"]').should('have.value', 'Yes')
    cy.get('select[name="typeOfFPClient"]').invoke('val').should('not.be.empty')
    cy.contains('Asthma').should('exist')
    cy.contains('Condom').should('exist')
    cy.get('select[name="patientReferred"]').should('have.value', 'Yes')
    cy.get('select[name="serviceReferredFor"]').invoke('val').should('not.be.empty')

    cy.screenshot('family-planning-enrollment-filled')
  })

  // The two tests below record why a filled enrollment still cannot be saved.
  //
  // "Do you want to have more children?" is rendered required, and its options are
  // codeset-backed. So the form refuses to submit until it is answered, and
  // answering it posts a 36-character codeset uuid into
  // pbh_family_planning.want_more_children - a column the schema declares
  // VARCHAR(10). The insert overflows and the whole enrollment is rejected. There
  // is no third option: on this build the enrollment cannot be saved at all.
  //
  // Both will fail once the app is fixed, which is the point - swap them for a
  // 200/201 assertion at that stage.
  it('should not submit at all while the required more-children answer is missing (app defect)', () => {
    cy.intercept({ method: 'POST', url: FP_CREATE_URL }).as('enrollment')

    fillEnrollmentForm()
    cy.contains('button', 'Save').should('not.be.disabled').click({ force: true })
    cy.wait(4000)

    // Native validation on the required select blocks the submit outright, so
    // nothing is even attempted and the user is left on the form with no message.
    cy.get('@enrollment.all').should('have.length', 0)
    cy.url().should('include', '/family-planning/enroll')
  })

  it('should be refused by the server once more-children is answered (app defect)', () => {
    cy.intercept({ method: 'POST', url: FP_CREATE_URL }).as('enrollment')

    fillEnrollmentForm({ options: { wantMoreChildren: /spacing/i } })
    cy.contains('button', 'Save').should('not.be.disabled').click({ force: true })

    cy.wait('@enrollment', { timeout: 30000 }).then(({ request, response }) => {
      const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
      const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)

      expect(response?.statusCode, `enrollment refused.\nresponse: ${body}\nrequest: ${sent}`).to.equal(400)
      expect(body, 'refused as a data conflict').to.match(/BUSINESS_RULE_VIOLATION/)

      // The overflowing value, for whoever picks this up.
      expect(JSON.parse(sent).wantMoreChildren, 'more-children posts a codeset uuid')
        .to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    })
  })
})
