// Routine Immunization (/pbh/immunization).
//
// The most completely wired public health module on this build: every form posts to
// a real endpoint and validates before it does, so unlike HTS, ART, PrEP and TB
// screening, these saves can actually be verified.
//
//   routine dose   POST /plugin/pbh/api/immunizations/routine
//   tetanus        POST /plugin/pbh/api/immunizations/tetanus
//   covid-19       POST /plugin/pbh/api/immunizations/covid19
//   RI card        POST/PUT /plugin/ehr/api/v1/patient-drug-administration/...
//
// Getting to the forms:
//   worklist -> row action "Dashboard" -> the SHARED patient dashboard at
//   /pbh/patients/dashboard, on its Immunization tab. Not
//   /pbh/immunization/patient-dashboard, which the plugin still declares a route
//   for but which renders an empty page on this build.
//
//   From that tab: "Create RI Card" builds the schedule, "New Immunization" opens
//   Routine / Tetanus / Covid-19, and each card row offers "View Vaccination
//   Details", "Mark as Administered" and "Enter reason for missed vaccination".
//
// Every one of those pages is reached with router state (patientUuid, visitUuid,
// returnPath) rather than URL parameters. The form routes do render on a direct
// cy.visit, but with no patient attached - so always navigate through the UI.
//
// The queue is a real service-point posting queue - the same mechanism as family
// planning - so it can be empty. ensureImmunizationPatient handles both cases.

import { ACTION_MENU, openPage } from './app-nav'
import { patientRegistration } from './patient-flow'
import {
  checkInPatient,
  openPatientDashboard as openEhrPatientDashboard,
  postPatientToServicePoint,
} from './opd-consultation-fill-form'

export const IMMUNIZATION_ROUTE = '/pbh/immunization'

export const IMMUNIZATION_POST = /\/plugin\/pbh\/api\/immunizations\/(routine|tetanus|covid19)/
export const DRUG_ADMIN_URL = /\/plugin\/ehr\/api\/v1\/patient-drug-administration/

// The dropdown's three destinations, by the label it shows.
export const NEW_IMMUNIZATION = {
  routine: 'Routine Immunization',
  tetanus: 'Tetanus Immunization',
  covid: 'Covid-19 Immunization',
}

export const openImmunizationWorklist = () => {
  openPage(IMMUNIZATION_ROUTE, /Routine Immunization/i)
  cy.wait(2500)
}

// True when the worklist has a real row rather than its "no data" placeholder.
const hasPatients = ($body) => $body.find('tbody tr button[aria-label="Open actions menu"]').length > 0

// Posts a toddler to the IMMUNIZATION service point and returns her hospital
// number. A child rather than the default adult because the routine card is an
// age-based schedule.
export const registerImmunizationClient = () => {
  const hospitalNumber = patientRegistration({ sex: /female/i, age: '2', ageUnit: 'Years' })

  openEhrPatientDashboard(hospitalNumber)
  checkInPatient()
  postPatientToServicePoint(/immunization/i)

  return hospitalNumber
}

// Uses whoever is already waiting, and only makes a patient when nobody is. Keeps
// a run on a populated environment fast and read-only, while still working on an
// empty one. Either way it yields a hospital number, so the rest of the run always
// works on one known patient rather than "whatever is first".
export const ensureImmunizationPatient = () => {
  openImmunizationWorklist()

  return cy.get('body').then(($body) => {
    if (hasPatients($body)) {
      // Hospital No is the first column of this worklist.
      const existing = ($body.find('tbody tr').first().find('td').first().text() || '').trim()
      cy.log(`using ${existing}, already waiting for immunization`)
      return cy.wrap(existing, { log: false })
    }

    cy.log('immunization queue empty - registering and posting a child')
    const hospitalNumber = registerImmunizationClient()
    return cy.wrap(hospitalNumber, { log: false })
  })
}

const searchWorklist = (term) => {
  cy.get('input[placeholder="Search..."]', { timeout: 20000 }).clear({ force: true })
  cy.get('input[placeholder="Search..."]').type(term, { force: true, delay: 40 })
  cy.wait(3000)
}

// Finds the patient in whichever queue currently holds them.
//
// Saving an immunisation completes the patient's service-point posting, so the
// same child is in "Patients in Waiting" before the first form is saved and in
// "Patients Attended To" afterwards. A spec that only ever looks at the waiting
// queue passes once and then cannot find its own patient.
//
// An empty queue still renders one row - the "no data" placeholder - so presence
// of the actions trigger is what says the patient is really here.
const findPatientRow = (hospitalNumber) => {
  if (hospitalNumber) searchWorklist(hospitalNumber)

  return cy.get('body').then(($body) => {
    if ($body.find('tbody tr button[aria-label="Open actions menu"]').length) return

    cy.log('not in the waiting queue - looking in Patients Attended To')
    cy.contains('button', 'Patients Attended To').click({ force: true })
    cy.wait(3500)
    if (hospitalNumber) searchWorklist(hospitalNumber)
  })
}

// Opens the patient dashboard from the worklist, on its Immunization tab.
export const openImmunizationDashboard = (hospitalNumber) => {
  openImmunizationWorklist()
  findPatientRow(hospitalNumber)

  cy.get('tbody tr button[aria-label="Open actions menu"]', { timeout: 30000 })
    .first()
    .click({ force: true })
  cy.get(ACTION_MENU, { timeout: 15000 }).should('exist')
  cy.get(ACTION_MENU).contains('button', 'Dashboard').click({ force: true })

  // The shared dashboard, not the immunization-specific route - see the note above.
  cy.url({ timeout: 30000 }).should('include', '/patients/dashboard')
  cy.contains('button', 'New Immunization', { timeout: 30000 }).should('exist')
  cy.wait(2000)
}

// The shared Modal renders a hashed `-modal` container holding a header with a
// close button and a body. Its primary action is the last real button in it, which
// is steadier than guessing at a label that differs per modal.
export const modalContainer = () => cy.get('[class*="-modal"]', { timeout: 20000 })

export const submitModal = () => {
  cy.get('[class*="-modal"]').find('button').then(($buttons) => {
    const actionable = [...$buttons].filter(
      (button) => !/closeButton/.test(button.className || '') && (button.innerText || '').trim()
    )
    expect(actionable.length, 'the modal offers an action').to.be.greaterThan(0)

    const primary = actionable[actionable.length - 1]
    cy.log(`submitting the modal with "${(primary.innerText || '').trim()}"`)
    cy.wrap(primary).click({ force: true })
  })
}

// The card's schedule is built once per patient. Builds it when the table is empty
// and leaves it alone when it is already there, so the spec is re-runnable against
// the same child.
export const ensureRoutineCard = () => {
  cy.get('body').then(($body) => {
    if ($body.find('tbody tr button[aria-label="Open actions menu"]').length) {
      cy.log('routine immunization card already exists for this patient')
      return
    }

    cy.contains('button', 'Create RI Card').click({ force: true })
    cy.wait(2000)

    // The modal repeats the label of the button that opened it, so the actionable
    // one is the last.
    cy.get('button')
      .filter((_i, button) => /^Create RI Card$/i.test((button.innerText || '').trim()))
      .last()
      .click({ force: true })
    cy.wait(6000)
  })
}

// Opens a card row action on the first vaccine that offers it.
//
// Two reasons this is not simply "the first row":
//   - the full card groups its vaccines under age headings ("Birth", "6 Weeks"),
//     and those heading rows are <tr>s carrying no actions at all
//   - what a row offers depends on its state, so once a vaccine has been recorded
//     as given or missed it stops offering the actions it had while pending
export const openCardRowAction = (label) => {
  const tryRow = (index) => {
    cy.get('tbody tr button[aria-label="Open actions menu"]', { timeout: 30000 }).then(($triggers) => {
      if (index >= $triggers.length) {
        throw new Error(`no vaccine row on the card offers "${label}"`)
      }

      cy.wrap($triggers[index]).click({ force: true })
      cy.get(ACTION_MENU, { timeout: 15000 }).should('exist')

      cy.get(ACTION_MENU).then(($menu) => {
        const offered = [...$menu.find('button')].map((button) => (button.innerText || '').trim())

        if (offered.includes(label)) {
          cy.get(ACTION_MENU).contains('button', label).click({ force: true })
          cy.wait(2500)
          return
        }

        cy.log(`vaccine ${index} offers [${offered.join(', ')}] - trying the next one`)
        cy.get('body').type('{esc}', { force: true })
        cy.wait(400)
        tryRow(index + 1)
      })
    })
  }

  tryRow(0)
}

// Picks one of the three from the "New Immunization" dropdown.
//
// The forms do NOT navigate. Despite the plugin declaring /pbh/immunization/tetanus
// and friends - and those routes rendering if visited directly, patientless - the
// deployed dashboard swaps the form into its immunization tab as a sub-view behind
// a "Back" link, leaving the URL on /pbh/patients/dashboard. So arrival is asserted
// on the sub-view's own heading, never on the URL.
export const startNewImmunization = (label) => {
  cy.contains('button', 'New Immunization', { timeout: 20000 }).click({ force: true })
  cy.wait(800)
  cy.contains('button', label, { timeout: 15000 }).click({ force: true })

  // Every one of these sub-views opens on an "Immunization Details" section.
  cy.contains('Immunization Details', { timeout: 30000 }).should('exist')
  cy.wait(1500)
}

// The dashboard's routine table is a summary: its row actions and the "View Full
// Card" button all lead to the same full card sub-view, and only there do the
// administer and missed-dose modals exist.
export const openFullCard = () => {
  cy.contains('button', 'View Full Card', { timeout: 20000 }).click({ force: true })
  cy.contains('Routine Immunization Card', { timeout: 30000 }).should('exist')
  cy.wait(2500)
}

// Leaves a sub-view and returns to the immunization tab.
export const backFromSubView = () => {
  cy.contains('Back', { timeout: 15000 }).click({ force: true })
  cy.wait(2000)
}
