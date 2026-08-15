// Family Planning enrollment form (/pbh/family-planning/enroll).
//
// Reaching it is the hard part: the form is opened from a row action on the
// Family Planning worklist, and that queue starts empty on a fresh environment -
// nothing is posted to the FAMILY_PLANNING service point by default. So the flow
// is register -> check in -> post to FAMILY_PLANNING -> open the row action.
//
// Deployed-build facts, enumerated from qa.lamisplus.org:
//   - service point is spelled FAMILY_PLANNING and lives under the OUTPATIENT
//     facility location
//   - waiting-row actions are "Family Planning Enrollment" and "Follow-Up"
//   - all four accordion sections are expanded on arrival, so nothing needs
//     opening before it can be filled
//   - every dropdown is a native <select> carrying a name attribute; the ids are
//     mangled from the labels (select-client's-religion*), so name is the handle
//   - the five dates are MUI pickers with read-only inputs and no name at all
//   - the only react-select on the page is the medical conditions autocomplete
//   - the form has no client-side validation: Save always posts, so asserting the
//     response is the only way to know the enrollment was accepted

import { ACTION_MENU, ROUTES, openPage } from './app-nav'
import { patientRegistration } from './patient-flow'
import {
  checkInPatient,
  openPatientDashboard,
  postPatientToServicePoint,
} from './opd-consultation-fill-form'
// Shared MUI date-picker driver: same control family as the consultation form.
import { pickDate } from './encounter-form'

// Anchored so it cannot also match the follow-up endpoint, which is this URL
// plus /follow-up.
export const FP_CREATE_URL = /\/plugin\/pbh\/api\/v1\/family-planning$/

const settle = 800

// ---------------------------------------------------------------------------
// Field helpers - keyed on the name attribute
// ---------------------------------------------------------------------------

// Pick the option matching `matcher`, else the first real one. Waits for the
// list to be populated: most of these are codeset-backed and arrive empty.
export const chooseByName = (name, matcher) => {
  cy.get(`select[name="${name}"]`, { timeout: 20000 })
    .should(($sel) => {
      const real = [...$sel[0].options].filter((o) => o.value)
      expect(real.length, `options loaded for "${name}"`).to.be.greaterThan(0)
    })
    .then(($sel) => {
      const options = [...$sel[0].options].filter((o) => o.value)
      const picked = (matcher && options.find((o) => matcher.test(o.text))) || options[0]
      cy.log(`${name} -> ${picked.text}`)
      cy.wrap($sel).select(picked.value, { force: true })
    })
  cy.wait(settle)
}

// For the conditional fields: several only render once their parent answer is
// given, and a codeset with no entries means the control never appears at all.
export const chooseByNameIfPresent = (name, matcher) =>
  cy.get('body').then(($body) => {
    if (!$body.find(`select[name="${name}"]`).length) {
      cy.log(`"${name}" is not on the form for this combination`)
      return
    }
    chooseByName(name, matcher)
  })

export const typeByName = (name, value) => {
  cy.get(`[name="${name}"]`, { timeout: 20000 })
    .clear({ force: true })
    .type(String(value), { force: true, delay: 30 })
  cy.wait(400)
}

// The conditions autocomplete is the form's only react-select, so it is taken by
// prefix rather than by an index that would shift if another were ever added.
export const addMedicalCondition = (condition = 'Asthma') => {
  cy.get('[id^="react-select-"][id$="-input"]', { timeout: 20000 }).then(($inputs) => {
    expect($inputs.length, 'the medical conditions autocomplete').to.be.greaterThan(0)
    const index = $inputs[0].id.replace(/^react-select-/, '').replace(/-input$/, '')

    cy.get(`#react-select-${index}-input`).click({ force: true })
    cy.get(`#react-select-${index}-input`).type(condition, { force: true, delay: 40 })
    cy.get(`[id^="react-select-${index}-option"]`, { timeout: 20000 })
      .should('have.length.greaterThan', 0)
      .first()
      .click({ force: true })
  })

  // Accepted conditions become chips; the select clears itself for the next one.
  cy.contains(condition, { timeout: 15000 }).should('exist')
  cy.wait(settle)
}

// Every date here is a MUI picker whose input is read-only, so the value has to
// come from the calendar - and the calendar opens on the current month with today
// preselected, which is exactly what the API refuses for history fields. A
// pregnancy that ended today, or a menstrual period that started and ended today,
// comes back as BUSINESS_RULE_VIOLATION ("data conflict"), so these are walked
// back through the calendar's own month navigation instead.
//
// The pickers cap at today (maxDate) and have no lower bound, so earlier months
// are always selectable.
export const pickPastDate = (labelText, { monthsBack = 1, day = 10 } = {}) => {
  cy.contains('label', labelText, { timeout: 20000 }).then(($label) => {
    let node = $label[0]

    for (let depth = 0; depth < 6 && node.parentElement; depth += 1) {
      node = node.parentElement
      const trigger = node.querySelector('button[aria-label="Choose date"]')
      if (trigger) {
        cy.wrap(trigger).click({ force: true })
        return
      }
    }

    throw new Error(`no date picker found near the "${labelText}" label`)
  })

  cy.get('[role="dialog"]', { timeout: 20000 }).should('be.visible')

  for (let step = 0; step < monthsBack; step += 1) {
    cy.get('[role="dialog"]').find('button[aria-label*="Previous"]').click({ force: true })
    cy.wait(400)
  }

  cy.get('[role="dialog"]')
    .find('button[role="gridcell"]:not([disabled])')
    .contains(new RegExp(`^${day}$`))
    .click({ force: true })

  cy.get('[role="dialog"]').should('not.exist')
  cy.wait(settle)
}

// ---------------------------------------------------------------------------
// Getting to the form
// ---------------------------------------------------------------------------

// A female client, checked in and waiting at the family planning service point.
// Returns her hospital number.
export const registerFamilyPlanningClient = () => {
  const hospitalNumber = patientRegistration({ sex: /female/i })

  openPatientDashboard(hospitalNumber)
  checkInPatient()
  postPatientToServicePoint(/family[_ ]?planning/i)

  return hospitalNumber
}

export const openEnrollmentForm = (hospitalNumber) => {
  openPage(ROUTES.familyPlanning, /Family Planning Services/i)

  // clear and type are issued as separate queries: the worklist re-renders when
  // its postings arrive and detaches whatever was captured before that.
  cy.wait(2500)
  cy.get('input[placeholder="Search..."]', { timeout: 20000 }).clear({ force: true })
  cy.get('input[placeholder="Search..."]').type(hospitalNumber, { force: true, delay: 40 })
  cy.wait(3000)

  cy.contains('tbody tr', hospitalNumber, { timeout: 45000 })
    .find('button[aria-label="Open actions menu"]')
    .click({ force: true })
  cy.get(ACTION_MENU, { timeout: 15000 }).should('exist')

  cy.get(ACTION_MENU).contains('button', 'Family Planning Enrollment').click({ force: true })

  cy.url({ timeout: 30000 }).should('include', '/family-planning/enroll')
  cy.contains('Reproductive History', { timeout: 30000 }).should('exist')
  cy.wait(1500)
}

// ---------------------------------------------------------------------------
// Filling the sections
// ---------------------------------------------------------------------------

// Section 1. "Start Date of Last Menstrual Period" is labelled twice - once here
// and again in section 2 - but both pickers write the same field, so filling the
// first fills both.
//
// Only the visit itself is dated today. The history dates are pushed into the
// past, and the menstrual period is given a start before its end, because the API
// rejects the calendar's defaults outright.
export const fillReproductiveHistory = ({
  breastfeedingStatus = 'Not breastfeeding',
  menstrualCycleDuration = 28,
} = {}) => {
  pickDate('Date of Visit')
  chooseByName('clientReligion', /christianity/i)
  chooseByName('sourceOfReferral', /clinic personnel/i)
  chooseByName('numberOfPregnancies', /^2$/)
  chooseByName('numberOfLivingChildren', /^2$/)
  pickPastDate('Month and Year Last Pregnancy Ended', { monthsBack: 6, day: 10 })
  chooseByName('resultOfLastPregnancy', /^NORMAL$/i)
  typeByName('breastfeedingStatus', breastfeedingStatus)
  // Anchored: /regular/i would match "Irregular" first.
  chooseByName('menstrualCycleRegularity', /^Regular$/)
  typeByName('menstrualCycleDuration', menstrualCycleDuration)
  pickPastDate('Start Date of Last Menstrual Period', { monthsBack: 1, day: 5 })
  pickPastDate('End Date of Last Menstrual Period', { monthsBack: 1, day: 10 })
}

// Section 2. `contraceptiveUsedPrior: 'Yes'` reveals three further selects, and
// `emergencyContraception: 'Yes'` reveals the method one.
//
// "Do you want to have more children?" is deliberately left blank by default.
// Its options are codeset-backed, so answering it posts a 36-character uuid into
// pbh_family_planning.want_more_children, which the schema declares VARCHAR(10) -
// the insert overflows and the whole enrollment comes back 400
// BUSINESS_RULE_VIOLATION. Pass `wantMoreChildren` to answer it anyway; see the
// defect test in family-planning-enrollment.cy.js.
export const fillFamilyPlanningOptions = ({
  wantMoreChildren = null,
  contraceptiveUsedPrior = /^No$/,
  emergencyContraception = /^No$/,
} = {}) => {
  if (wantMoreChildren) chooseByName('wantMoreChildren', wantMoreChildren)
  chooseByName('contraceptiveUsedPrior', contraceptiveUsedPrior)

  chooseByNameIfPresent('mostRecentContraceptiveUsed')
  chooseByNameIfPresent('methodOfPriorContraceptive')
  chooseByNameIfPresent('sourceOfPriorContraceptive')

  chooseByName('counselledOnFP', /^Yes$/)
  chooseByName('counselledOnPPFP', /^Yes$/)
  chooseByName('firstTimeModernFPUser', /^Yes$/)
  chooseByName('emergencyContraception', emergencyContraception)
  chooseByName('typeOfFPClient', /^Routine$/)

  chooseByNameIfPresent('emergencyContraceptionMethod')
}

// Section 3.
export const fillInitialMedicalExamination = ({ condition = 'Asthma' } = {}) => {
  chooseByName('breastAssessmentStatus', /^NORMAL$/i)
  chooseByName('uterusPosition', /anteverted/i)
  chooseByName('sizeOfUterus', /^NORMAL$/i)
  addMedicalCondition(condition)
}

// Section 4's method picker. "Add Method" stays disabled until both the method
// and the visit type are answered; which extra fields appear is derived from the
// method's label - condoms ask for a quantity, oral pills for cycles, IUD and
// implant for in/out, and In/Out=Out then asks for a reason.
export const addFamilyPlanningMethod = ({
  method = /^Condom$/,
  visitType = /new acceptor/i,
} = {}) => {
  chooseByName('fpMethod', method)
  chooseByName('visitType', visitType)

  chooseByNameIfPresent('specificProductType')
  chooseByNameIfPresent('quantity', /^2$/)
  chooseByNameIfPresent('numberOfCycles', /^2$/)
  chooseByNameIfPresent('inOut', /^In$/)
  chooseByNameIfPresent('reason')

  cy.contains('button', 'Add Method', { timeout: 20000 })
    .should('not.be.disabled')
    .click({ force: true })
  cy.wait(1500)
}

// Section 4's referral pair. Service Referred For is rendered disabled until the
// patient is marked as referred.
export const fillReferral = ({ referred = /^Yes$/ } = {}) => {
  chooseByName('patientReferred', referred)

  cy.get('select[name="serviceReferredFor"]').then(($sel) => {
    if ($sel[0].disabled) {
      cy.log('patient not referred, service referred for stays locked')
      return
    }
    chooseByName('serviceReferredFor')
  })
}

// The whole enrollment, section by section. Leaves it unsaved so the caller can
// assert on the submission itself.
export const fillEnrollmentForm = (overrides = {}) => {
  fillReproductiveHistory(overrides.reproductiveHistory)
  fillFamilyPlanningOptions(overrides.options)
  fillInitialMedicalExamination(overrides.examination)
  addFamilyPlanningMethod(overrides.method)
  fillReferral(overrides.referral)
}
