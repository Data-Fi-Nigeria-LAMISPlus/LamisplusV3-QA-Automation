// A generic filler for the accordion forms this build is made of.
//
// Why generic rather than a named helper per field: these forms are enormous and
// almost entirely built from the same four primitives. The PrEP screening form
// alone has 57 native selects; the ART care card has 23 selects and 6 date
// pickers. Enumerating them by hand would be thousands of lines that rot the
// moment a field is renamed, and it would not test anything a sweep does not.
//
// The primitives, all verified on qa.lamisplus.org:
//   native <select name="...">      the shared Select component, always with a
//                                   value="" placeholder option first
//   <input name="...">              text/number, sometimes disabled (derived) or
//                                   readonly (MUI date inputs, computed scores)
//   button[aria-label="Choose date"] MUI date picker, value only settable from
//                                   the calendar popup
//   react-select                    searchable dropdowns, options in a body portal
//
// Everything is addressed by name attribute and re-queried immediately before
// use, because answering one field re-renders the section and detaches anything
// captured earlier.

const settle = 250

// Accordion sections are collapsed by default on most of these forms and their
// content is not rendered at all until expanded. Expansion shows up as an
// `accordionHeaderExpanded` class on the header button, and headers are the
// buttons whose text starts with the section number.
export const expandAllSections = () => {
  cy.get('body').then(($body) => {
    const headers = [...$body.find('button')].filter((button) =>
      /^\d+\s/.test((button.innerText || '').replace(/\n/g, ' ').trim()))

    headers.forEach((header) => {
      if (!/accordionHeaderExpanded/.test(header.className || '')) {
        cy.wrap(header).click({ force: true })
        cy.wait(200)
      }
    })
  })
  cy.wait(1200)
}

export const sectionTitles = () =>
  cy.get('body').then(($body) =>
    [...$body.find('button')]
      .map((button) => (button.innerText || '').replace(/\s+/g, ' ').trim())
      .filter((text) => /^\d+\s/.test(text)))

// ---------------------------------------------------------------------------
// Native selects
// ---------------------------------------------------------------------------

// Takes the first real option unless a preference matches. Skips anything already
// answered, disabled, or with nothing to offer - an empty dropdown is reported by
// assertNothingLeftEmpty rather than failing here, so one bad codeset does not
// mask the rest of the form.
const answerSelect = (name, preferences) => {
  cy.get('body').then(($body) => {
    const element = $body.find(`select[name="${name}"]`)[0]
    if (!element || element.disabled || element.value) return

    const options = [...element.options].filter((option) => option.value)
    if (!options.length) {
      cy.log(`select "${name}" has no options`)
      return
    }

    const preferred = preferences?.[name]
    const picked = (preferred && options.find((option) => preferred.test(option.text))) || options[0]

    // Answered by setting the value and firing change in one synchronous step,
    // rather than with cy.select().
    //
    // Some forms recompute on every answer and re-render the whole section - TB
    // screening derives its presumptive-TB outcome that way. cy.select() is a
    // multi-step action, so that re-render lands mid-action and it fails with
    // "the page updated while this command was executing". Nothing can be retried
    // around it, because the next answer causes the same re-render again.
    //
    // React reads the value off the change event, so this registers normally.
    cy.get(`select[name="${name}"]`, { timeout: 20000 }).then(($select) => {
      const element = $select[0]
      element.value = picked.value
      element.dispatchEvent(new Event('change', { bubbles: true }))
    })
    cy.wait(settle)

    // If the app rejected the value - a controlled select can revert one it did not
    // hear about - fall back to Cypress's own action, which handles the odd
    // component that listens for something else.
    cy.get(`select[name="${name}"]`).then(($select) => {
      if ($select[0].value !== picked.value) {
        cy.log(`"${name}" did not take the native change, retrying with cy.select`)
        cy.get(`select[name="${name}"]`).select(picked.value, { force: true })
        cy.wait(settle)
      }
    })
  })
}

export const fillSelects = ({ preferences, skip = [] } = {}) => {
  cy.get('body').then(($body) => {
    const names = [...new Set(
      [...$body.find('select')]
        .filter((element) => element.name && !element.disabled && !element.value)
        .map((element) => element.name)
    )]

    names.filter((name) => !skip.includes(name)).forEach((name) => answerSelect(name, preferences))
  })
}

// ---------------------------------------------------------------------------
// Text and number inputs
// ---------------------------------------------------------------------------

// One plausible value per field shape. Nothing on these forms validates format,
// but phone and numeric fields are given something of the right kind so a future
// validation rule does not turn this into a mystery failure.
const valueFor = (element) => {
  const name = (element.name || '').toLowerCase()

  if (element.type === 'number') {
    if (/weight/.test(name)) return '62'
    if (/height/.test(name)) return '165'
    if (/circumference|area/.test(name)) return '45'
    return '2'
  }
  if (/phone|mobile/.test(name)) return '08012345678'
  if (/email/.test(name)) return 'qa.automation@example.com'
  if (/pressure/.test(name)) return '120/80'
  if (/code|uniqueid|unique_id|ovcid|id$/.test(name)) return 'QA-0001'
  if (/name|supporter|clinician|designation|completedby|providedby/.test(name)) return 'QA Automation'
  if (/address/.test(name)) return '12 Test Street, Lagos'
  if (/regimen|ultrasound|ctscan|score/.test(name)) return 'QA test value'
  return 'QA automation'
}

export const fillTextInputs = ({ skip = [] } = {}) => {
  cy.get('body').then(($body) => {
    const targets = [...$body.find('input, textarea')].filter((element) => {
      const type = element.type || 'textarea'
      if (['checkbox', 'radio', 'hidden', 'file', 'submit', 'button'].includes(type)) return false
      return element.name && !element.disabled && !element.readOnly && !element.value && !skip.includes(element.name)
    })

    const names = [...new Set(targets.map((element) => element.name))]

    names.forEach((name) => {
      cy.get('body').then(($current) => {
        const element = $current.find(`[name="${name}"]`)[0]
        if (!element || element.disabled || element.readOnly || element.value) return

        cy.get(`[name="${name}"]`).first().clear({ force: true })
        cy.get(`[name="${name}"]`).first().type(valueFor(element), { force: true, delay: 0 })
      })
    })
  })
  cy.wait(settle)
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

// Pickers are addressed by index because the MUI inputs beside them carry
// generated ids (:r0:, :r3:) and no name. Each is re-queried before use, and one
// already showing a date is left alone.
//
// `monthsBack` exists because history fields are refused by the API when they
// land on today - see the family planning module for the same rule.
export const fillDates = ({ monthsBack = 0, day = 10 } = {}) => {
  cy.get('body').then(($body) => {
    const total = $body.find('button[aria-label="Choose date"]').length

    for (let index = 0; index < total; index += 1) {
      cy.get('body').then(($current) => {
        const triggers = $current.find('button[aria-label="Choose date"]')
        if (index >= triggers.length) return

        const trigger = triggers[index]
        if (trigger.disabled) return

        // The picker's own input is the text box nearest the trigger.
        const wrapper = trigger.closest('div')
        const input = wrapper?.parentElement?.querySelector('input')
        if (input && /\d{4}-\d{2}-\d{2}/.test(input.value || '')) return

        cy.wrap(trigger).click({ force: true })
        cy.wait(600)

        // Not every picker opens: some forms render one for a field the record
        // supplies itself, and it stays inert. Skip those rather than waiting out
        // a timeout on a calendar that is never coming.
        cy.get('body').then(($opened) => {
          if (!$opened.find('[role="dialog"]').length) {
            cy.log(`date picker ${index} did not open - inert on this form`)
            return
          }

          for (let step = 0; step < monthsBack; step += 1) {
            cy.get('[role="dialog"]').find('button[aria-label*="Previous"]').click({ force: true })
            cy.wait(300)
          }

          cy.get('[role="dialog"]').then(($dialog) => {
            const target = monthsBack
              ? $dialog.find('button[role="gridcell"]:not([disabled])').filter((_i, cell) => cell.innerText.trim() === String(day))
              : $dialog.find('button[aria-current="date"]:not([disabled])')
            const fallback = $dialog.find('button[role="gridcell"]:not([disabled])')
            cy.wrap((target.length ? target : fallback).first()).click({ force: true })
          })

          cy.get('[role="dialog"]').should('not.exist')
          cy.wait(settle)
        })
      })
    }
  })
}

// ---------------------------------------------------------------------------
// react-selects, checkboxes, radios
// ---------------------------------------------------------------------------

export const fillReactSelects = () => {
  cy.get('body').then(($body) => {
    const ids = [...$body.find('[id^="react-select-"][id$="-input"]')].map((element) => element.id)

    ids.forEach((id) => {
      const index = id.replace(/^react-select-/, '').replace(/-input$/, '')

      cy.get('body').then(($current) => {
        const input = $current.find(`#${CSS.escape(id)}`)[0]
        if (!input || input.disabled) return

        cy.get(`#${CSS.escape(id)}`).click({ force: true })
        cy.wait(400)
        cy.get('body').then(($open) => {
          const options = $open.find(`[id^="react-select-${index}-option"]`)
          if (!options.length) {
            cy.log(`react-select ${index} offered nothing`)
            cy.get('body').type('{esc}', { force: true })
            return
          }
          cy.wrap(options[0]).click({ force: true })
          cy.wait(settle)
        })
      })
    })
  })
}

export const checkAllCheckboxes = () => {
  cy.get('body').then(($body) => {
    const total = $body.find('input[type="checkbox"]:not([disabled])').length

    for (let index = 0; index < total; index += 1) {
      cy.get('body').then(($current) => {
        const boxes = $current.find('input[type="checkbox"]:not([disabled])')
        if (index >= boxes.length || boxes[index].checked) return
        cy.wrap(boxes[index]).click({ force: true })
        cy.wait(150)
      })
    }
  })
}

// One answer per radio group.
export const answerRadioGroups = () => {
  cy.get('body').then(($body) => {
    const names = [...new Set(
      [...$body.find('input[type="radio"]:not([disabled])')].map((element) => element.name).filter(Boolean)
    )]

    names.forEach((name) => {
      cy.get('body').then(($current) => {
        const group = $current.find(`input[type="radio"][name="${name}"]`)
        if (![...group].some((radio) => radio.checked)) {
          cy.wrap(group[0]).click({ force: true })
          cy.wait(150)
        }
      })
    })
  })
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

// Selects run first and twice: answering one reveals dependent fields, and the
// second pass catches whatever the first pass brought into existence. Text inputs
// come after the checkboxes for the same reason - "Other" boxes reveal a
// specify-here field.
// `skipDates` is for forms whose date picker cannot be used - TB screening crashes
// into an error boundary the moment a date is chosen from the calendar - so the
// rest of the form can still be filled and asserted.
export const fillEverything = ({ preferences, skip = [], monthsBack = 0, skipDates = false } = {}) => {
  expandAllSections()

  fillSelects({ preferences, skip })
  fillSelects({ preferences, skip })

  if (!skipDates) fillDates({ monthsBack })
  fillReactSelects()
  checkAllCheckboxes()
  answerRadioGroups()

  fillTextInputs({ skip })
  fillSelects({ preferences, skip })
  fillTextInputs({ skip })
}

// The strongest assertion available on forms that persist nothing: after the
// sweep, no enabled, writable, named control is still empty. It catches dropdowns
// whose codeset returned nothing and dependents that never unlocked - both of
// which look like a filled form to the eye.
//
// `ignore` is for fields a documented app defect makes unfillable.
export const assertNothingLeftEmpty = ({ ignore = [] } = {}) => {
  cy.get('body').then(($body) => {
    const empty = []
    let considered = 0

    ;[...$body.find('select')].forEach((element) => {
      if (element.disabled || !element.name || ignore.includes(element.name)) return
      considered += 1
      if (!element.value) empty.push(`select[${element.name}]`)
    })

    ;[...$body.find('input, textarea')].forEach((element) => {
      const type = element.type || 'textarea'
      if (['checkbox', 'radio', 'hidden', 'file', 'submit', 'button'].includes(type)) return
      if (element.disabled || element.readOnly || !element.name || ignore.includes(element.name)) return
      considered += 1
      if (!element.value) empty.push(`${type}[${element.name}]`)
    })

    // Non-vacuous on purpose: a form that has crashed into an error boundary has no
    // fields at all, and "none of zero fields is empty" would otherwise pass and
    // report a filled form. That is exactly what happened on TB screening before
    // this check existed.
    expect(considered, 'the form still has fields to check').to.be.greaterThan(0)
    expect(empty, 'every writable field answered').to.deep.equal([])
  })
}

// Dates live in readonly inputs with generated ids, so they are counted rather
// than named: every picker on the form should have left a date behind.
export const assertEveryDateFilled = () => {
  cy.get('body').then(($body) => {
    const pickers = $body.find('button[aria-label="Choose date"]:not([disabled])').length
    const dated = [...$body.find('input')].filter((element) => /\d{4}-\d{2}-\d{2}/.test(element.value || '')).length

    expect(dated, `all ${pickers} date pickers answered`).to.be.at.least(pickers)
  })
}
