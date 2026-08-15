// Inpatient helpers shared between the bed and admission specs.
//
// Bed creation lives here rather than in a spec because specs cannot import each
// other: the admission test needs a free bed, and QA only ever has as many beds
// as someone has created, so it makes its own instead of competing for the one
// that already exists.

import { patientRegistration } from './patient-flow'
import {
  checkInPatient,
  clickActionMenuItem,
  openPatientDashboard,
  openRowActionMenu,
} from './opd-consultation-fill-form'

const settle = 800

// Puts a patient on the Scheduled For Admission queue, via Emergency Admission on
// a patient row.
//
// The admission spec needs this as setup: QA only had the two scheduled
// admissions someone had created by hand, and admitting them consumed both, after
// which every admission test failed with "Expected to find element:
// button[aria-label='Open actions menu']" - there was simply nobody left to admit.
//
// Date Of Schedule and Admission Type arrive prefilled; the clinician is free text
// (no autocomplete) and notes are required.
export const scheduleAdmission = () => {
  // The patient needs an open visit first. Scheduling against a patient who is
  // not checked in is rejected by the API with 404 "Could not create visit for
  // scheduled admission" and visitUuid: null in the payload, so this registers a
  // patient and checks them in before scheduling.
  const hospitalNumber = patientRegistration()

  openPatientDashboard(hospitalNumber)
  checkInPatient()

  cy.visit('/patients')
  openRowActionMenu(hospitalNumber)
  clickActionMenuItem('Emergency Admission')

  cy.contains('Schedule Admission', { timeout: 30000 }).should('exist')
  cy.wait(settle)

  cy.get('[id="input-admitting-clinician*"]', { timeout: 20000 })
    .clear({ force: true })
    .type('Dr QA Automation', { force: true })

  cy.get('#notes').clear({ force: true }).type('Scheduled by automated admission test.', { force: true })

  cy.intercept('POST', '**/scheduled-admissions**').as('scheduleAdmission')
  cy.contains('button', 'Save', { timeout: 20000 }).click({ force: true })

  cy.wait('@scheduleAdmission', { timeout: 30000 }).then(({ request, response }) => {
    const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
    const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
    expect(
      response?.statusCode,
      `schedule admission rejected.\nresponse: ${body}\nrequest: ${sent}`
    ).to.be.oneOf([200, 201])
  })
  cy.wait(2000)

  return hospitalNumber
}

// Schedules a discharge for an already-admitted patient and returns that
// patient's hospital number.
//
// Discharge is two steps on this build: "Schedule Discharge" from the Admitted
// Patients queue puts the patient on /ipc/discharge under Discharge Scheduled,
// and the discharge is completed from there.
//
// It has to start from an admitted patient rather than a fresh one: getting a new
// patient admitted needs a scheduled admission, and the API currently refuses to
// create one (404 "Could not create visit for scheduled admission", visitUuid
// null) - see scheduleAdmission() below.
export const scheduleDischarge = () => {
  cy.visit('/ipc/admissions')
  cy.contains(/Admissions to In-Patient Services/i, { timeout: 30000 }).should('exist')

  cy.contains('button', 'Admitted Patients', { timeout: 20000 }).click({ force: true })
  cy.wait(3000)

  cy.get('tbody tr', { timeout: 45000 }).should('have.length.greaterThan', 0)

  return cy.get('tbody tr').eq(0).find('td').eq(0).invoke('text').then((raw) => {
    const hospitalNumber = (raw || '').replace(/\s+/g, ' ').trim()

    cy.get('tbody tr').eq(0).find('td').last().find('button').first().click({ force: true })
    cy.get('body > div[class*="-menu"]', { timeout: 15000 })
      .contains('button', 'Schedule Discharge')
      .click({ force: true })

    cy.contains('Schedule Discharge', { timeout: 30000 }).should('exist')
    cy.wait(settle)

    // Both selects store uuids, so pick by visible text and assert only that
    // something was chosen.
    cy.get('[id="select-reason-for-discharge*"]', { timeout: 20000 })
      .select('Discharged to home', { force: true })
    cy.wait(settle)

    cy.get('#select-discharge-scheduled-by').then(($select) => {
      const first = [...$select[0].options].find((option) => option.value)
      if (first) cy.wrap($select).select(first.value, { force: true })
    })

    cy.get('[id="textarea-notes*"]')
      .clear({ force: true })
      .type('Discharge scheduled by automated test.', { force: true })

    cy.intercept('POST', '**').as('scheduleDischarge')
    cy.contains('button', 'Save', { timeout: 20000 }).click({ force: true })

    cy.wait('@scheduleDischarge', { timeout: 30000 }).then(({ request, response }) => {
      const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
      const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
      expect(
        response?.statusCode,
        `schedule discharge rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`
      ).to.be.oneOf([200, 201])
    })

    cy.wait(2500)
    return cy.wrap(hospitalNumber, { log: false })
  })
}

// Creates a bed and returns its code. Suffixed with a timestamp so repeat runs
// cannot collide on the bed code.
export const createBed = () => {
  const bedCode = `QA-BED-${`${Date.now()}`.slice(-6)}`

  cy.visit('/ipc/bed-management')
  cy.contains(/Bed Management/i, { timeout: 30000 }).should('exist')

  cy.contains('button', 'Create Bed', { timeout: 20000 }).click({ force: true })
  cy.contains('Create Bed Space', { timeout: 20000 }).should('exist')
  cy.url().should('include', '/ipc/bed-management/create')

  cy.get('[id="input-bed-code-*"]', { timeout: 20000 })
    .clear({ force: true })
    .type(bedCode, { force: true })

  // Bed Category is a react-select; take whatever the first option is.
  cy.get('body').then(($body) => {
    if ($body.find('#react-select-2-input').length) {
      cy.get('#react-select-2-input').click({ force: true })
      cy.get('[id^="react-select-2-option"]', { timeout: 20000 })
        .should('have.length.greaterThan', 0)
        .first()
        .click({ force: true })
      cy.wait(settle)
    }
  })

  // Ward is a native select storing a uuid.
  cy.get('[id="select-ward-*"]', { timeout: 20000 }).should(($select) => {
    const real = [...$select[0].options].filter((option) => option.value)
    expect(real.length, 'a ward exists to attach the bed to').to.be.greaterThan(0)
  })
  cy.get('[id="select-ward-*"]').then(($select) => {
    const first = [...$select[0].options].find((option) => option.value)
    cy.wrap($select).select(first.value, { force: true })
  })
  cy.wait(settle)

  // Any date on the form is a read-only MUI picker, so drive the calendar if one
  // is present.
  cy.get('body').then(($body) => {
    if ($body.find('button[aria-label="Choose date"]').length) {
      cy.get('button[aria-label="Choose date"]').first().click({ force: true })
      cy.get('[role="dialog"]', { timeout: 15000 }).should('be.visible')
      cy.get('[role="dialog"]').then(($dialog) => {
        const today = $dialog.find('button[aria-current="date"]:not([disabled])')
        const target = today.length ? today.first() : $dialog.find('button[role="gridcell"]:not([disabled])').first()
        cy.wrap(target).click({ force: true })
      })
      cy.get('[role="dialog"]').should('not.exist')
      cy.wait(settle)
    }
  })

  cy.intercept('POST', '**').as('createBed')
  cy.contains('button', 'Save', { timeout: 20000 }).click({ force: true })

  // Saving may route through an "are you sure" confirmation, as several forms on
  // this build do.
  cy.wait(1200)
  cy.get('body').then(($body) => {
    if (/are you sure/i.test(($body.text() || '').replace(/\s+/g, ' '))) {
      cy.get('button')
        .filter((_i, el) => /^(save|confirm|yes)$/i.test((el.innerText || '').trim()))
        .last()
        .click({ force: true })
    }
  })

  cy.wait('@createBed', { timeout: 30000 }).then(({ request, response }) => {
    const body = typeof response?.body === 'string' ? response.body : JSON.stringify(response?.body)
    const sent = typeof request?.body === 'string' ? request.body : JSON.stringify(request?.body)
    expect(
      response?.statusCode,
      `create bed rejected.\nurl: ${request?.url}\nresponse: ${body}\nrequest: ${sent}`
    ).to.be.oneOf([200, 201])
  })

  return bedCode
}
