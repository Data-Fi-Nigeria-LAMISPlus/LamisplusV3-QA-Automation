// OPD flow against the DEPLOYED QA frontend.
//
// This file used to drive the '/ehr/*' UI from the app source (MUI DataGrid +
// data-testid="core-common-*"). None of that is deployed: '/ehr/*' 404s, the
// tables are plain <table>, and the build ships NO data-testid attributes at
// all. Verified against qa.lamisplus.org by enumerating the live DOM.
//
// Deployed route map:
//   patient list      /patients
//   registration form /patients/register
//   patient dashboard /patients/dashboard   (reached via row action -> Dashboard)
//   OPD hub           /opd                  (cards, no hrefs)
//   triage worklist   /opd/triage
//   vitals form       /opd/triage/record
//   consultation      /opd/consultation
//
// Selector conventions on this build:
//   table search      input[placeholder="Search..."]
//   row action menu   button[aria-label="Open actions menu"]
//   menu portal       [data-cy="action-menu"] (mounted as a trailing body child)
//   form controls     ids are generated and sometimes mangled
//                     (input-temperature-(Â°c), select-service-point-*), so
//                     fields are resolved via their <label for> or placeholder.

import { patientRegistration, pickDateFromCalendar } from './patient-flow'

const shortPause = 900
const stagePause = 1600

export const routes = {
  patients: '/patients',
  patientRegister: '/patients/register',
  opdHub: '/opd',
  triage: '/opd/triage',
  consultation: '/opd/consultation',
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

// Resolve a control from its visible label. Ids on this build contain '*' and
// parentheses, so they are matched with a quoted attribute selector rather than
// interpolated into a '#id' selector.
const fieldByLabel = (labelText) =>
  cy
    .get('label', { timeout: 20000 })
    .filter((_i, el) => new RegExp(labelText, 'i').test(el.textContent || ''))
    .first()
    .invoke('attr', 'for')
    .then((id) => {
      expect(id, `label "${labelText}" points at a control`).to.be.a('string')
      return cy.get(`[id="${id}"]`, { timeout: 20000 })
    })

// Pick the first option matching `matcher`, else the first real option.
// Waits for the list to be populated first: several of these selects are
// dependent (Service Point stays empty until Facility Location is chosen), and
// reading options too early silently posts the form with no value.
export const selectByLabel = (labelText, matcher) => {
  fieldByLabel(labelText)
    .should(($sel) => {
      const real = [...$sel[0].options].filter((o) => o.value)
      expect(real.length, `options loaded for "${labelText}"`).to.be.greaterThan(0)
    })
    .then(($sel) => {
      const options = [...$sel[0].options].filter((o) => o.value)
      const picked = (matcher && options.find((o) => matcher.test(o.text))) || options[0]
      cy.log(`${labelText} -> ${picked.text}`)
      cy.wrap($sel).select(picked.value, { force: true })
    })
  cy.wait(shortPause)
}

export const typeByLabel = (labelText, value) => {
  fieldByLabel(labelText).clear({ force: true }).type(value, { force: true, delay: 40 })
  cy.wait(400)
}

export const typeByPlaceholder = (placeholder, value) => {
  cy.get(`input[placeholder="${placeholder}"]`, { timeout: 20000 })
    .clear({ force: true })
    .type(value, { force: true, delay: 40 })
  cy.wait(300)
}

// A dialog repeats the label of the header button that opened it ("Check In",
// "Post Patient"), so the actionable control is the LAST match, not the first.
const clickLastButton = (labelRe) => {
  cy.get('button', { timeout: 20000 })
    .filter((_i, el) => labelRe.test((el.innerText || '').trim()))
    .last()
    .should('not.be.disabled')
    .click({ force: true })
}

// Several Save buttons on this build only open an "Are you sure..." modal whose
// own button does the submitting. Confirm it when it appears.
const confirmIfPrompted = (labelRe) => {
  cy.wait(shortPause)
  cy.get('body').then(($body) => {
    if (/are you sure/i.test($body.text() || '')) {
      clickLastButton(labelRe)
    }
  })
}

// ---------------------------------------------------------------------------
// Worklist helpers
// ---------------------------------------------------------------------------

// Filter the table down to one patient and open that row's action menu.
// The menu renders into a body-level portal, so the row is re-queried fresh on
// every call - a jQuery reference captured in an earlier .then() is stale by the
// time the portal opens and clicking it silently does nothing.
export const openRowActionMenu = (identifier) => {
  cy.get('table', { timeout: 45000 }).should('exist')
  cy.get('input[placeholder="Search..."]', { timeout: 20000 })
    .clear({ force: true })
    .type(identifier, { force: true, delay: 60 })
  cy.wait(2500)

  cy.contains('tbody tr', identifier, { timeout: 45000 })
    .find('button[aria-label="Open actions menu"]')
    .click({ force: true })

  // Existence, not visibility: the portal is absolutely positioned via inline
  // top/left and Cypress does not always score it visible, but it is clickable.
  cy.get('[data-cy="action-menu"]', { timeout: 15000 }).should('exist')
  cy.wait(shortPause)
}

export const clickActionMenuItem = (itemLabel) => {
  cy.get('[data-cy="action-menu"]', { timeout: 15000 })
    .contains('button', itemLabel, { timeout: 15000 })
    .click({ force: true })
  cy.wait(stagePause)
}

export const openPatientDashboard = (hospitalNumber) => {
  cy.visit(routes.patients)
  openRowActionMenu(hospitalNumber)
  clickActionMenuItem('Dashboard')

  cy.contains('Patient Dashboard', { timeout: 30000 }).should('exist')
  cy.contains(hospitalNumber, { timeout: 20000 }).should('exist')
}

// ---------------------------------------------------------------------------
// Check in / post
// ---------------------------------------------------------------------------

// Opens a facility visit. Distinct from posting to a service point: this only
// flips the header button to "Check Out". Skipped when the patient already has
// an open visit.
export const checkInPatient = () => {
  cy.get('body').then(($body) => {
    const alreadyIn = [...$body.find('button')].some((b) => /^check out$/i.test((b.innerText || '').trim()))
    if (alreadyIn) {
      cy.log('patient already checked in, skipping check-in')
      return
    }

    cy.contains('button', 'Check In', { timeout: 20000 }).click({ force: true })
    cy.contains('Check In Patient', { timeout: 20000 }).should('exist')
    cy.wait(stagePause)

    // Date and time are prefilled by the app; only the required selects and the
    // comment need supplying.
    selectByLabel('Check In Type', /new consultation/i)
    selectByLabel('Checked In By')
    typeByLabel('Comments', 'Checked in by automated OPD regression run')

    clickLastButton(/^check in$/i)
    cy.wait(stagePause)
    cy.contains('button', 'Check Out', { timeout: 30000 }).should('exist')
  })
}

// Fills and submits an already-open Post Patient dialog. Split out from
// postPatientToServicePoint because the dialog is reachable two ways: the button
// on the patient dashboard, and the "Post Patient" row action on the triage
// Attended tab.
//
// Facility Location must be chosen first - Service Point is populated from it,
// and submitting while it is still empty creates a visit that never lands on any
// worklist.
export const fillPostPatientDialog = (servicePointMatcher) => {
  cy.contains('Post Patient', { timeout: 20000 }).should('exist')
  cy.wait(stagePause)

  selectByLabel('Facility Location', /outpatient/i)
  selectByLabel('Service Point', servicePointMatcher)
  selectByLabel('Priority', /routine/i)
  selectByLabel('Posted By')
  typeByLabel('Note', 'Posted by automated OPD regression run')

  clickLastButton(/^post patient$/i)
  cy.wait(stagePause)
}

// Routes the patient to a service point from the patient dashboard.
export const postPatientToServicePoint = (servicePointMatcher) => {
  cy.contains('button', 'Post Patient', { timeout: 20000 }).click({ force: true })
  fillPostPatientDialog(servicePointMatcher)
}

// Shared setup for the triage-facing specs: a brand new patient, checked in and
// waiting on the triage worklist. Each spec makes its own patient so they can
// run in any order without competing for the same row.
export const registerAndPostToTriage = () => {
  const hospitalNumber = patientRegistration()

  openPatientDashboard(hospitalNumber)
  checkInPatient()
  postPatientToServicePoint(/triage/i)

  return hospitalNumber
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

export const captureTriageVitals = (hospitalNumber) => {
  cy.visit(routes.triage)
  cy.contains('Triage', { timeout: 30000 }).should('exist')

  openRowActionMenu(hospitalNumber)
  clickActionMenuItem('Capture Vitals')

  cy.url({ timeout: 30000 }).should('include', '/opd/triage/record')

  // Placeholders rather than ids: the generated ids are mangled by the unit
  // suffixes (input-temperature-(Â°c), input-oxygen-saturation-(%)).
  typeByPlaceholder('Pulse', '72')
  typeByPlaceholder('Respiratory rate', '18')
  typeByPlaceholder('Temperature', '36.8')
  typeByPlaceholder('Systolic', '120')
  typeByPlaceholder('Diastolic', '80')
  typeByPlaceholder('Oxygen saturation', '98')
  typeByPlaceholder('Weight', '70')
  typeByPlaceholder('Height', '175')

  // Assert the vitals actually persisted rather than assuming the click stuck -
  // the consultation posting that follows does not depend on them, so a silently
  // dropped save would otherwise go unnoticed.
  cy.intercept({ method: 'POST', url: /(triage|vital)/ }).as('saveVitals')
  cy.contains('button', 'Save', { timeout: 20000 }).should('not.be.disabled').click({ force: true })
  confirmIfPrompted(/^save$/i)

  cy.wait('@saveVitals', { timeout: 30000 }).then(({ request, response }) => {
    const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
    expect(
      response?.statusCode,
      `save vitals rejected.\nurl: ${request?.url}\nresponse: ${body}`
    ).to.be.oneOf([200, 201])
  })
  cy.wait(stagePause)
}

// ---------------------------------------------------------------------------
// Consultation
// ---------------------------------------------------------------------------

// Assumes the patient has been posted to the consultation service point and is
// sitting on the "Patients in Waiting" tab of /opd/consultation.
export const fillConsultationForm = ({ hospitalNumber }) => {
  cy.visit(routes.consultation)
  cy.contains('Consultation', { timeout: 30000 }).should('exist')
  cy.wait(shortPause)

  openRowActionMenu(hospitalNumber)

  // Log the menu before acting so a renamed action shows up in the failure
  // output as the real cause instead of a bare "element not found".
  cy.get('[data-cy="action-menu"]').then(($menu) => {
    const items = [...$menu.find('button')].map((b) => (b.innerText || '').trim())
    cy.log(`consultation row menu: ${items.join(' | ')}`)
    const target = items.find((t) => /consult|fill|form|attend/i.test(t))
    expect(target, `a consultation action exists in [${items.join(', ')}]`).to.be.a('string')
    cy.get('[data-cy="action-menu"]').contains('button', target).click({ force: true })
  })

  cy.url({ timeout: 30000 }).should('include', '/opd/consultation/encounter')
  cy.contains('Physical Examination', { timeout: 20000 }).should('exist')
  cy.wait(stagePause)

  // Section 1 carries the only fields Save hard-requires. Visit Type arrives
  // prefilled ("New Consultation"); Encounter Date does not, and submitting
  // without it fails with "Encounter date is required".
  //
  // Encounter Date is a MUI picker whose input is readonly (typing is a no-op -
  // the field just keeps showing its YYYY-MM-DD mask), so the value has to come
  // from the calendar popup. Same control family as the registration form's
  // dates, so the same helper drives it.
  pickDateFromCalendar(0)
  cy.get('[data-cy="consult-date"]', { timeout: 15000 })
    .invoke('val')
    .should('match', /\d{4}/)

  cy.get('[id="select-is-this-visit-a-referral?"]', { timeout: 20000 }).select('NO', { force: true })
  cy.wait(shortPause)

  // Assert the encounter was actually persisted. The form stays on /encounter
  // either way and only raises a toast on failure, so checking the response is
  // the difference between "saved" and "silently rejected".
  cy.intercept({ method: 'POST', url: /(consultation|encounter)/ }).as('saveConsultation')

  // Save is a two-step: the page button only opens a "Save Consultation"
  // confirmation modal, and the modal's own Save is what submits. Clicking just
  // the first one fires no request at all - and because the form raises no
  // validation error in that state, asserting only on error text would pass
  // while nothing was ever persisted.
  cy.contains('button', 'Save', { timeout: 20000 }).should('not.be.disabled').click({ force: true })
  cy.contains('Save Consultation', { timeout: 20000 }).should('exist')
  confirmIfPrompted(/^save$/i)

  cy.wait('@saveConsultation', { timeout: 30000 }).then(({ request, response }) => {
    const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
    const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
    expect(
      response?.statusCode,
      `save consultation rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`
    ).to.be.oneOf([200, 201])
  })

  cy.get('body', { timeout: 20000 }).should(($body) => {
    const text = ($body.text() || '').replace(/\s+/g, ' ')
    expect(text, 'no validation complaint after save')
      .to.not.match(/Please complete the form before submitting|is required/i)
  })

  cy.screenshot('opd-consultation-form-saved')
}
