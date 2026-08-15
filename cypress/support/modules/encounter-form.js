// Helpers for the consultation encounter form (/opd/consultation/encounter).
//
// The form has five accordion sections which stay mounted once opened, so the
// react-select instances are numbered stably in DOM order:
//
//   1 Physical Examination   date picker 0, react-select-2 Visit Type (prefilled),
//                            select#select-is-this-visit-a-referral?
//   2 Presenting Complaints  textarea#patientVisitNotes, react-select-3 Complaint,
//                            react-select-4 Severity, date picker 1 Onset Date,
//                            button "Add Complaint"
//   3 Clinical Diagnosis     input#icd11-, react-select-5 Priority,
//                            react-select-6 Certainty, button "Add Diagnosis"
//   4 Laboratory Test Orders react-select-7/8 Test, 9/10 Specimen + Priority,
//                            button "Add Lab"
//   5 Pharmacy Orders        date picker "Prescription Date", selects Medication
//                            Name / Formulation / Route of Admin / Strength /
//                            Frequency, input-dosage-amount-*,
//                            input-duration-in-days-*, button "Add Pharmacy"
//
// Nothing here has a label/for pair or a test id, hence the index-based access.
// Sections 4 and 5 are driven by label/placeholder instead - see chooseByLabel.
//
// Two things about section 5 that the app source does not show, both verified on
// qa.lamisplus.org: there is no Duration Unit select (duration is a single
// "Duration in days" field), and input-quantity-prescribed-* is rendered
// disabled - the build derives the quantity rather than accepting one.

import { ACTION_MENU, openFirstRowMenu } from './app-nav'

const settle = 900

// The consultation worklist row action that opens the encounter form. Both
// ordering specs (lab, pharmacy) enter the form this way.
export const openConsultationEncounter = () => {
  openFirstRowMenu()
  cy.get(ACTION_MENU).contains('button', 'Fill Consultation Form').click({ force: true })

  cy.url({ timeout: 30000 }).should('include', '/opd/consultation/encounter')
  cy.contains('Physical Examination', { timeout: 30000 }).should('exist')
}

export const openSection = (title) => {
  cy.contains(title, { timeout: 20000 }).click({ force: true })
  cy.wait(2000)
}

// Every date on this form is a read-only MUI picker: typing is a no-op, the value
// has to come from the calendar.
//
// Located by the field's label rather than by index: collapsed sections stay in
// the DOM, so the number of pickers present does not match what is on screen and
// an index silently addresses the wrong field.
export const pickDate = (labelText) => {
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
  cy.get('[role="dialog"]').then(($dialog) => {
    const today = $dialog.find('button[aria-current="date"]:not([disabled])')
    if (today.length) {
      cy.wrap(today.first()).click({ force: true })
    } else {
      cy.wrap($dialog).find('button[role="gridcell"]:not([disabled])').first().click({ force: true })
    }
  })

  cy.get('[role="dialog"]').should('not.exist')
  cy.wait(settle)
}

// Open a react-select, optionally type to filter, then take the first option.
// Dependent selects ("Select a drug first") only populate once their parent is
// set, so the option list is waited for rather than read immediately.
export const chooseOption = (index, query) => {
  cy.get(`#react-select-${index}-input`, { timeout: 20000 }).click({ force: true })

  if (query) {
    cy.get(`#react-select-${index}-input`).type(query, { force: true, delay: 60 })
  }

  cy.get(`[id^="react-select-${index}-option"]`, { timeout: 25000 })
    .should('have.length.greaterThan', 0)
    .first()
    .click({ force: true })

  cy.wait(settle)
}

// Choose a react-select by the placeholder it shows rather than by index.
//
// The numbering is only stable for a given set of open sections: with sections 2
// and 3 expanded the lab controls are 7-10, but with only section 4 open they
// shift down and #react-select-7-input does not exist at all. Matching the
// placeholder text is order-independent.
export const chooseByPlaceholder = (placeholder) => {
  cy.get('[id^="react-select-"][id$="-input"]', { timeout: 20000 }).then(($inputs) => {
    const match = [...$inputs].find((input) => {
      let node = input
      for (let depth = 0; depth < 4 && node.parentElement; depth += 1) {
        node = node.parentElement
        if (new RegExp(placeholder, 'i').test((node.innerText || '').replace(/\s+/g, ' '))) return true
      }
      return false
    })

    expect(match, `a react-select showing "${placeholder}"`).to.not.be.undefined

    const index = match.id.replace(/^react-select-/, '').replace(/-input$/, '')
    chooseOption(index)
  })
}

// Resolve the react-select nearest to a <label>, yielding its index.
//
// Walks outwards from the label because the labels on this form carry no `for`:
// most of these selects are wrapped in a bare flex div with the label as a
// sibling, so the match is found one level up. Yields null instead of throwing
// when `required` is false - a disabled react-select renders no input at all.
const selectIndexByLabel = (labelText, { required = true } = {}) =>
  cy.contains('label', labelText, { timeout: 20000 }).then(($label) => {
    let node = $label[0]

    for (let depth = 0; depth < 5 && node.parentElement; depth += 1) {
      node = node.parentElement
      const input = node.querySelector('[id^="react-select-"][id$="-input"]')
      if (input) return input.id.replace(/^react-select-/, '').replace(/-input$/, '')
    }

    if (required) throw new Error(`no react-select found near the "${labelText}" label`)
    return null
  })

// Choose a react-select by the <label> above it.
//
// Needed because not every control shows a placeholder: "Lab Test Type" renders
// an empty control whose only identifying text is its label, so placeholder
// matching cannot find it.
export const chooseByLabel = (labelText) => {
  selectIndexByLabel(labelText).then((index) => chooseOption(index))
}

// Open a react-select and take its first option only if it has any, yielding
// whether something was chosen.
//
// The dependent selects ("Select a drug first", "Select a formulation first")
// stay empty - and disabled - until their parent is set, and a drug whose
// formulations are all archived leaves them empty for good. chooseOption's hard
// assertion is the right default; this is for the callers that need to branch.
export const chooseOptionIfAny = (index) => {
  // force: a dependent select is rendered disabled, and clicking it is how we
  // find out whether it has anything to offer.
  cy.get(`#react-select-${index}-input`, { timeout: 20000 }).click({ force: true })
  cy.wait(settle)

  return cy.get('body').then(($body) => {
    const options = $body.find(`[id^="react-select-${index}-option"]`)

    // Both branches return a chain rather than a bare boolean: returning a
    // synchronous value after queueing cy commands is an error in Cypress.
    if (!options.length) {
      return cy.get('body').type('{esc}', { force: true }).then(() => false)
    }

    return cy.wrap(options[0]).click({ force: true }).wait(settle).then(() => true)
  })
}

export const chooseByLabelIfAny = (labelText) =>
  selectIndexByLabel(labelText, { required: false }).then((index) => {
    if (index === null) {
      cy.log(`"${labelText}" has no usable react-select (disabled)`)
      return false
    }
    return chooseOptionIfAny(index)
  })

// Numeric fields on this form are matched on their placeholder: the generated
// ids are mangled (input-dosage-amount-*) and their labels sit outside any
// wrapper a walk could rely on.
export const typeByPlaceholder = (placeholder, value) => {
  cy.get(`input[placeholder="${placeholder}"]`, { timeout: 20000 })
    .clear({ force: true })
    .type(String(value), { force: true, delay: 40 })
  cy.wait(400)
}

export const fillPhysicalExamination = () => {
  pickDate('Encounter Date')
  cy.get('[data-cy="consult-date"]', { timeout: 15000 }).invoke('val').should('match', /\d{4}/)

  cy.get('[id="select-is-this-visit-a-referral?"]', { timeout: 20000 }).select('NO', { force: true })
  cy.wait(settle)
}

export const addPresentingComplaint = (notes = 'Headache and mild fever for two days.') => {
  openSection('Presenting Complaints')

  cy.get('textarea#patientVisitNotes', { timeout: 20000 })
    .clear({ force: true })
    .type(notes, { force: true, delay: 10 })

  chooseOption(3) // Presenting Complaint
  chooseOption(4) // Severity
  pickDate('Onset Date')

  cy.contains('button', 'Add Complaint', { timeout: 20000 })
    .should('not.be.disabled')
    .click({ force: true })
  cy.wait(2000)
}

// Medication Name drives the pharmacy section: Formulation is built from the
// chosen drug's formulations and Strength from the chosen formulation's
// strengths. A drug whose formulations are missing or archived leaves both
// dependents permanently empty, and the drug list gives no hint which those are,
// so candidates are tried in turn until one yields a formulation.
//
// The chosen drug name is aliased as @pharmacyDrug - it is the only way to
// assert the resulting order chip, since the fields reset once it is added.
export const chooseDrugWithFormulation = (candidate = 0, maxCandidates = 5) => {
  selectIndexByLabel('Medication Name').then((index) => {
    cy.get(`#react-select-${index}-input`).click({ force: true })

    // Remote search, debounced: the list arrives a beat after the menu opens.
    cy.get(`[id^="react-select-${index}-option"]`, { timeout: 25000 })
      .should('have.length.greaterThan', candidate)
      .then(($options) => {
        const option = $options[candidate]
        cy.wrap((option.innerText || '').trim()).as('pharmacyDrug')
        cy.wrap(option).click({ force: true })
      })
  })
  cy.wait(settle)

  chooseByLabelIfAny('Formulation').then((chosen) => {
    if (chosen) return

    if (candidate + 1 >= maxCandidates) {
      throw new Error(`none of the first ${maxCandidates} drugs has a formulation configured`)
    }
    cy.log(`drug ${candidate} has no formulation, trying the next one`)
    chooseDrugWithFormulation(candidate + 1, maxCandidates)
  })
}

// Fills one prescription. Leaves it unsubmitted: the caller clicks "Add
// Pharmacy" so it can assert on the transition itself.
//
// Quantity Prescribed takes no argument - the deployed build renders it disabled
// and derives it, so typing into it is impossible by design.
export const fillPharmacyOrder = ({ dosageAmount = 2, durationInDays = 5 } = {}) => {
  openSection('Pharmacy Orders')

  pickDate('Prescription Date')
  chooseDrugWithFormulation()

  // Strength depends on the chosen Formulation. A formulation with no strength
  // configured is logged rather than failing the run, since the order is still
  // accepted without one.
  chooseByLabelIfAny('Strength')

  // Route and Frequency are independent codeset lists.
  chooseByLabel('Route of Admin')
  chooseByLabel('Frequency')

  typeByPlaceholder('Dosage amount', dosageAmount)
  typeByPlaceholder('Duration in days', durationInDays)
}

export const addClinicalDiagnosis = (search = 'malaria') => {
  openSection('Clinical Diagnosis')

  cy.get('input#icd11-', { timeout: 20000 })
    .clear({ force: true })
    .type(search, { force: true, delay: 80 })
  cy.wait(2500)

  // The ICD-11 lookup is a remote search; take the first suggestion it returns.
  cy.get('body').then(($body) => {
    const suggestion = $body.find('[role="option"], li[class*="option"], [class*="suggestion"]')
    if (suggestion.length) {
      cy.wrap(suggestion[0]).click({ force: true })
      cy.wait(settle)
    } else {
      cy.log('ICD-11 lookup returned no suggestions for this term')
    }
  })

  chooseOption(5) // Priority
  chooseOption(6) // Certainty

  cy.contains('button', 'Add Diagnosis', { timeout: 20000 })
    .should('not.be.disabled')
    .click({ force: true })
  cy.wait(2000)
}
