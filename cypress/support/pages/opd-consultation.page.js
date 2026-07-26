/**
 * OPD Consultation Page - Reusable methods for OPD consultation form
 * Functional approach (JavaScript modules, not class-based)
 */

const shortPause = 500
const mediumPause = 700
const stagePause = 1400

export const typeFieldSlowly = (selector, value) => {
  cy.get(selector, { timeout: 15000 })
    .should('exist')
    .clear({ force: true })
    .type(value, { force: true, delay: 170 })
  cy.wait(shortPause)
}

export const typeByFieldName = (fieldName, value) => {
  cy.get(`input[name="${fieldName}"]`, { timeout: 15000 })
    .should('exist')
    .clear({ force: true })
    .type(value, { force: true, delay: 170 })
  cy.wait(shortPause)
}

export const typeByAriaLabel = (label, value) => {
  cy.get(`[aria-label="${label}"]`)
    .click()
    .type(value);
};

export const typeDateByLabel = (dateFieldLabel, section, value) => {
  cy.get('label').each(($label) => {
    if ($label.text().trim().startsWith(dateFieldLabel)) {
      const $parent = $label.parent();

      if ($parent.find('.ehr-c0e75541fc947b2a-radioText').length > 0) {
        cy.log(`Skipping radio field: ${$label.text().trim()}`);
      } else {
        cy.wrap($parent)
          .find(`[aria-label="${section}"]`)
          .click()
          .type(value);
      }
    }
  });
};

export const typeByLabelText = (labelMatcher, value) => {
  cy.get('body').then(($body) => {
    const label = [...$body.find('label')].find((lbl) =>
      labelMatcher.test((lbl.innerText || '').trim())
    )

    if (label) {
      const input = label.closest('div')?.querySelector('input')
      if (input) {
        cy.wrap(input).clear({ force: true }).type(value, { force: true, delay: 170 })
        cy.wait(shortPause)
        return
      }
    }

    throw new Error(`Unable to find input for label matching: ${labelMatcher}`)
  })
}

export const selectAutocompleteOption = (placeholder, optionText) => {
  // Find and click the input
  cy.get('body').then(($body) => {
    const exactInput = $body.find(`input[placeholder="${placeholder}"]`)
    let targetInput = exactInput[0]

    // Fallback to partial match if exact match not found
    if (!targetInput) {
      const placeholderToken = placeholder.replace(/^select\s+/i, '').trim().toLowerCase()
      const partialInput = [...$body.find('input[placeholder]')].find((input) =>
        (input.getAttribute('placeholder') || '').toLowerCase().includes(placeholderToken)
      )
      targetInput = partialInput
    }

    if (!targetInput) {
      cy.log(`Skipping autocomplete field not found: ${placeholder}`)
      return
    }

    // Type the option text
    cy.wrap(targetInput)
      .clear({ force: true })
      .type(optionText, { force: true, delay: 120 })
  })

  cy.wait(mediumPause)

  // Select the matching option from dropdown
  cy.get('body').then(($body) => {
    const options = $body.find('.MuiAutocomplete-popper [role="option"]')
    if (!options.length) {
      cy.log(`No options available for: ${placeholder}`)
      return
    }

    const matchedOption = [...options].find((option) =>
      new RegExp(optionText, 'i').test(option.innerText)
    )

    cy.wrap(matchedOption || options[0]).click({ force: true })
  })

  cy.wait(mediumPause)
}

export const selectReactSelectOption = (placeholder, optionText) => {
  cy.contains('.ss__placeholder', placeholder)
    .closest('.ss__control')
    .find('input[role="combobox"]')
    .click({timeout:3000})
    .type(optionText);
};


// export const selectReactSelectOption = (placeholder) => {
//   cy.contains('.ss__placeholder', placeholder)
//     .closest('.ss__control')
//     .find('input[role="combobox"]')
//     .click({timeout:2000})

// //   cy.get('#react-select-2-option-0')
// //     .click();
// };

export const selectDropdownOption = (selectNo,optionNo)=>{
    cy.get(`#react-select-${selectNo}-option-${optionNo}`)
    .click();
}

export const selectFirstNativeOption = (selector) => {
  cy.get(selector, { timeout: 15000 })
    .should('exist')
    .should('not.be.disabled')
    .then(($sel) => {
      const options = [...$sel[0].options].map((opt) => opt.value).filter(Boolean)
      if (options.length) {
        cy.wrap($sel).select(options[0], { force: true })
      }
    })
  cy.wait(mediumPause)
}

export const selectMUIOptionMatching = (matcher) => {
  cy.get('.MuiAutocomplete-popper [role="option"]', { timeout: 15000 }).then(($options) => {
    const matchedOption = [...$options].find((option) => matcher.test(option.innerText))
    if (matchedOption) {
      cy.wrap(matchedOption).click({ force: true })
    } else {
      cy.wrap($options[0]).click({ force: true })
    }
  })
  cy.wait(mediumPause)
}

export const openConsultationSection = (sectionTitle) => {
  cy.contains('button', sectionTitle, { timeout: 15000 })
    .should('exist')
    .scrollIntoView({ offset: { top: -120, left: 0 } })
    .click({ force: true })
  cy.wait(stagePause)
}

export const ensureConsultationSectionOpen = (sectionTitle, requiredSelector) => {
  cy.get('body').then(($body) => {
    if (!$body.find(requiredSelector).length) {
      openConsultationSection(sectionTitle)
    }
  })

  cy.get(requiredSelector, { timeout: 15000 }).should('exist')
  cy.wait(shortPause)
}

export const filterTableByText = (valueText) => {
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="core-common-table-input"]').length) {
      cy.get('[data-testid="core-common-table-input"]')
        .clear({ force: true })
        .type(valueText, { force: true, delay: 100 })
    } else if ($body.find('[data-testid="core-common-table-button"]').length) {
      cy.get('[data-testid="core-common-table-button"]')
        .first()
        .click({ force: true })

      cy.get('[data-testid="core-common-table-input"]', { timeout: 15000 })
        .clear({ force: true })
        .type(valueText, { force: true, delay: 100 })
    }
  })

  cy.wait(1200)
}

export const clickTableRowMatching = (matcher) => {
  cy.get('body').then(($body) => {
    const rows = $body.find('table tbody tr')
    const matchedRow = [...rows].find((row) => matcher.test(row.innerText))
    if (matchedRow) {
      cy.wrap(matchedRow).click({ force: true })
    }
  })
  cy.wait(mediumPause)
}

export const clickGridActionForPatient = (patientIdentifier) => {
  cy.get('body', { timeout: 45000 }).should('not.contain', 'Loading...')
  cy.get('.MuiDataGrid-root', { timeout: 45000 }).should('exist')

  filterTableByText(patientIdentifier)

  cy.contains('.MuiDataGrid-row', patientIdentifier, { timeout: 60000 })
    .should('exist')
    .within(() => {
      cy.get('[data-testid="core-common-action-menu-button"]', { timeout: 15000 })
        .click({ force: true })
    })

  cy.wait(1200)
}

export const clickTableRowAction = (matcher, actionName) => {
  cy.get('body').then(($body) => {
    const rows = $body.find('table tbody tr')
    const matchedRow = [...rows].find((row) => matcher.test(row.innerText))

    if (matchedRow) {
      const actionBtn = matchedRow.querySelector('[data-testid*="action"], button[aria-label*="action"], .action-menu')
      if (actionBtn) {
        cy.wrap(actionBtn).click({ force: true })
        cy.wait(500)

        // Click the action option
        const actionOption = [...$body.find('[role="menuitem"], .MuiMenuItem-root')].find((item) =>
          new RegExp(actionName, 'i').test(item.innerText)
        )
        if (actionOption) {
          cy.wrap(actionOption).click({ force: true })
        }
      }
    }
  })
  cy.wait(mediumPause)
}
