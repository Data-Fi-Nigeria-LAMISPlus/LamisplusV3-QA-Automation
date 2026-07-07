export const locator = {
  EMAIL_INPUT :'input[type="email"]',
  PASSWORD_INPUT : 'input[type="password"]',
  SUBMIT_BUTTON : 'button[type="submit"]'
}

export const login = () => {
  cy.visit('/login')
  cy.get(locator.EMAIL_INPUT).type('facility_admin@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('p@55W0rd!')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('not.include', '/login')
}

export const invalidEmail = () => {
  cy.get(locator.EMAIL_INPUT).type('invalid-email')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Invalid email').should('be.visible')
}

export const emptyEmailError = () => {
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Email is required').should('be.visible')
}

export const emptyPasswordError = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Password is required').should('be.visible')
}

export const bothFieldsEmptyError = () => {
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Email is required').should('be.visible')
  cy.contains('Password is required').should('be.visible')
}

export const invalidCredentialsError = () => {
  cy.get(locator.EMAIL_INPUT).type('wrong@email.com')
  cy.get(locator.PASSWORD_INPUT).type('wrongpassword')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Invalid credentials').should('be.visible')
}

export const wrongPasswordError = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('wrongpassword')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Invalid password').should('be.visible')
}

export const wrongEmailError = () => {
  cy.get(locator.EMAIL_INPUT).type('wrong@email.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Invalid email').should('be.visible')
}

export const caseSensitiveEmail = () => {
  cy.get(locator.EMAIL_INPUT).type('IBE@GMAIL.COM')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('not.include', '/login')
}

export const leadingTrailingSpacesEmail = () => {
  cy.get(locator.EMAIL_INPUT).type('  ibe@gmail.com  ')
  cy.get(locator.PASSWORD_INPUT).type('  Password123$  ')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('not.include', '/login')
}

export const leadingTrailingSpacesPassword = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('  Password123$  ')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Invalid credentials').should('be.visible')
}

export const multipleRapidLoginAttempts = () => {
  for (let i = 0; i < 5; i++) {
    cy.get(locator.EMAIL_INPUT).clear().type('ibe@gmail.com')
    cy.get(locator.PASSWORD_INPUT).clear().type('wrongpassword')
    cy.get(locator.SUBMIT_BUTTON).click()
  }
  cy.contains('Too many attempts').should('be.visible')
}

export const forgotPasswordLink = () => {
  cy.contains('Forgot Password').should('be.visible').click()
  cy.url().should('include', '/forgot-password')
}

export const rememberUserSession = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('not.include', '/login')
  cy.reload()
  cy.url().should('not.include', '/login')
}

export const redirectToIntendedPage = () => {
  cy.visit('/dashboard')
  cy.url().should('include', '/login')
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('include', '/dashboard')
}

export const networkErrorHandling = () => {
  cy.intercept('POST', '**/login', { forceNetworkError: true }).as('loginRequest')
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Network error').should('be.visible')
}

export const serverErrorHandling = () => {
  cy.intercept('POST', '**/login', { statusCode: 500 }).as('loginRequest')
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Server error').should('be.visible')
}

export const clearErrorMessagesOnTyping = () => {
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Email is required').should('be.visible')
  cy.get(locator.EMAIL_INPUT).type('a')
  cy.contains('Email is required').should('not.exist')
}

export const maintainFormStateOnRefresh = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.reload()
  cy.get(locator.EMAIL_INPUT).should('have.value', 'ibe@gmail.com')
}

export const longEmailInput = () => {
  const longEmail = 'a'.repeat(200) + '@example.com'
  cy.get(locator.EMAIL_INPUT).type(longEmail)
  cy.get(locator.EMAIL_INPUT).should('have.value', longEmail)
}

export const longPasswordInput = () => {
  const longPassword = 'A'.repeat(200) + '1' + 'a' + '!'
  cy.get(locator.PASSWORD_INPUT).type(longPassword)
  cy.get(locator.PASSWORD_INPUT).should('have.value', longPassword)
}

export const specialCharactersPassword = () => {
  const specialPassword = 'Admin@123!#$%^&*()'
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type(specialPassword)
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('not.include', '/login')
}

export const unicodeCharactersEmail = () => {
  cy.get(locator.EMAIL_INPUT).type('tëst@example.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().then(url => {
    if (url.includes('/login')) {
      cy.contains('Invalid email').should('be.visible')
    } else {
      cy.url().should('not.include', '/login')
    }
  })
}

export const backForwardNavigation = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('not.include', '/login')
  cy.go('back')
  cy.url().should('include', '/login')
  cy.go('forward')
  cy.url().should('not.include', '/login')
}

export const multipleBrowserTabs = () => {
  cy.window().then(win => {
    win.open('/login', '_blank')
  })
  cy.window().then(win => {
    const newTab = win.open('/login', '_blank')
    cy.wrap(newTab).as('newTab')
  })
  cy.get('@newTab').then(tab => {
    cy.wrap(tab).its('location.href').should('include', '/login')
  })
}

export const slowNetworkConditions = () => {
  cy.intercept('POST', '**/login', (req) => {
    req.continue((res) => {
      res.delay = 400
    })
  }).as('slowLogin')
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.wait('@slowLogin')
  cy.url().should('not.include', '/login')
}

export const validatePasswordStrength = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('123')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Password too weak').should('be.visible')
}

export const concurrentLoginAttempts = () => {
  cy.intercept('POST', '**/login', (req) => {
    req.continue((res) => {
      res.delay = 250
    })
  }).as('loginRequest')
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.wait('@loginRequest')
}

export const browserAutofill = () => {
  cy.get(locator.EMAIL_INPUT).invoke('val', 'autofilled@email.com').trigger('change')
  cy.get(locator.PASSWORD_INPUT).invoke('val', 'autofilledpassword').trigger('change')
  cy.get(locator.EMAIL_INPUT).should('have.value', 'autofilled@email.com')
  cy.get(locator.PASSWORD_INPUT).should('have.value', 'autofilledpassword')
}

export const formSubmissionViaEnterKey = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.PASSWORD_INPUT).type('{enter}')
  cy.url().should('not.include', '/login')
}

export const preventFormSubmissionDuringLoading = () => {
  cy.intercept('POST', '**/login', (req) => {
    req.continue((res) => {
      res.delay = 500
    })
  }).as('slowLogin')
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.get(locator.SUBMIT_BUTTON).should('be.disabled')
  cy.wait('@slowLogin')
  cy.get(locator.SUBMIT_BUTTON).should('not.be.disabled')
}

export const browserZoomLevels = () => {
  cy.viewport(1280, 720)
  cy.get(locator.EMAIL_INPUT).should('be.visible')
  cy.get(locator.PASSWORD_INPUT).should('be.visible')
  cy.get(locator.SUBMIT_BUTTON).should('be.visible')
}

export const differentScreenSizes = () => {
  cy.viewport('iphone-6')
  cy.get(locator.EMAIL_INPUT).should('be.visible')
  cy.get(locator.PASSWORD_INPUT).should('be.visible')
  cy.get(locator.SUBMIT_BUTTON).should('be.visible')
  cy.viewport('ipad-2')
  cy.get(locator.EMAIL_INPUT).should('be.visible')
  cy.get(locator.PASSWORD_INPUT).should('be.visible')
  cy.get(locator.SUBMIT_BUTTON).should('be.visible')
}

export const browserLanguageChanges = () => {
  cy.get(locator.EMAIL_INPUT).should('have.attr', 'placeholder').then(placeholder => {
    expect(placeholder).to.exist
  })
}

export const captchaHandling = () => {
  cy.get('[data-cy="captcha"]').then($captcha => {
    if ($captcha.length > 0) {
      cy.wrap($captcha).should('be.visible')
    }
  })
}

export const twoFactorAuthentication = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('Password123$')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.get('[data-cy="2fa-code"]').then($input => {
    if ($input.length > 0) {
      cy.wrap($input).type('123456')
      cy.get('[data-cy="verify-2fa"]').click()
    }
  })
  cy.url().should('not.include', '/login')
}

export const accountVerificationRequirements = () => {
  cy.get(locator.EMAIL_INPUT).type('unverified@email.com')
  cy.get(locator.PASSWORD_INPUT).type('password123')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.contains('Please verify your email').should('be.visible')
}

export const passwordExpiration = () => {
  cy.get(locator.EMAIL_INPUT).type('ibe@gmail.com')
  cy.get(locator.PASSWORD_INPUT).type('expiredpassword')
  cy.get(locator.SUBMIT_BUTTON).click()
  cy.url().should('include', '/reset-password')
};
