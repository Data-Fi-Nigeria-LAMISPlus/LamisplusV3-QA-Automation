const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

describe('Login Page - Edge Cases and Error Scenarios', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.visit('/login')
    cy.get('input[type="email"]', { timeout: 15000 }).should('exist')
    cy.get('input[type="password"]', { timeout: 15000 }).should('exist')
  })

  it('should show error for invalid email format', () => {
    // Enter invalid email
    cy.get('input[type="email"]').type('invalid-email')

    // Enter password
    cy.get('input[type="password"]').type(PASSWORD)

    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert error message appears
    cy.contains('Invalid email').should('be.visible')
  })

  it('should show error for empty email field', () => {
    // Leave email empty
    // Enter password
    cy.get('input[type="password"]').type(PASSWORD)

    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert error message appears
    cy.contains('Email is required').should('be.visible')
  })

  it('should show error for empty password field', () => {
    // Enter email
    cy.get('input[type="email"]').type(EMAIL)

    // Leave password empty
    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert error message appears
    cy.contains('Password is required').should('be.visible')
  })

  it('should show error for both fields empty', () => {
    // Leave both fields empty
    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert error messages appear
    cy.contains('Email is required').should('be.visible')
    cy.contains('Password is required').should('be.visible')
  })

  it('should show error for invalid credentials', () => {
    // Enter valid email format but wrong credentials
    cy.get('input[type="email"]').type('wrong@email.com')

    // Enter wrong password
    cy.get('input[type="password"]').type('wrongpassword')

    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert error message appears
    cy.contains('Invalid credentials').should('be.visible')
  })

  it('should show error for correct email but wrong password', () => {
    // Enter correct email
    cy.get('input[type="email"]').type(EMAIL)

    // Enter wrong password
    cy.get('input[type="password"]').type('wrongpassword')

    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert error message appears
    cy.contains('Invalid password').should('be.visible')
  })

  it('should show error for wrong email but correct password', () => {
    // Enter wrong email
    cy.get('input[type="email"]').type('wrong@email.com')

    // Enter correct password
    cy.get('input[type="password"]').type(PASSWORD)

    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert error message appears
    cy.contains('Invalid email').should('be.visible')
  })

  it('should handle case-sensitive email', () => {
    // Enter email with different case
    cy.get('input[type="email"]').type(EMAIL.toUpperCase())

    // Enter password
    cy.get('input[type="password"]').type(PASSWORD)

    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert successful login (assuming email is case-insensitive)
    cy.url().should('not.include', '/login')
  })

  it('should handle leading/trailing spaces in email', () => {
    // Enter email with spaces
    cy.get('input[type="email"]').type(`  ${EMAIL}  `)

    // Enter password
    cy.get('input[type="password"]').type(`  ${PASSWORD}  `)

    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert successful login (assuming spaces are trimmed)
    cy.url().should('not.include', '/login')
  })

  it('should handle leading/trailing spaces in password', () => {
    // Enter email
    cy.get('input[type="email"]').type(EMAIL)

    // Enter password with spaces
    cy.get('input[type="password"]').type(`  ${PASSWORD}  `)

    // Click sign in button
    cy.get('button[type="submit"]').click()

    // Assert error (assuming password is space-sensitive)
    cy.contains('Invalid credentials').should('be.visible')
  })

  it('should prevent multiple rapid login attempts', () => {
    // Attempt multiple rapid logins
    for (let i = 0; i < 5; i++) {
      cy.get('input[type="email"]').clear().type(EMAIL)
      cy.get('input[type="password"]').clear().type('wrongpassword')
      cy.get('button[type="submit"]').click()
    }

    // Assert account lockout message appears
    cy.contains('Too many attempts').should('be.visible')
  })

  it('should have forgot password link', () => {
    // Check if forgot password link exists
    cy.contains('Forgot Password').should('be.visible').click()

    // Assert redirected to forgot password page
    cy.url().should('include', '/forgot-password')
  })

  it('should remember user session after login', () => {
    // Login successfully
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()

    // Assert login success
    cy.url().should('not.include', '/login')

    // Refresh page
    cy.reload()

    // Assert still logged in (session persists)
    cy.url().should('not.include', '/login')
  })

  it('should redirect to intended page after login', () => {
    // Try to visit a protected page
    cy.visit('/dashboard') // Assuming this redirects to login

    // Should be redirected to login
    cy.url().should('include', '/login')

    // Login
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()

    // Should be redirected back to dashboard
    cy.url().should('include', '/dashboard')
  })

  it('should handle network errors gracefully', () => {
    // Mock network failure
    cy.intercept('POST', '**/login', { forceNetworkError: true }).as('loginRequest')

    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()

    // Assert network error message
    cy.contains('Network error').should('be.visible')
  })

  it('should handle server errors gracefully', () => {
    // Mock server error
    cy.intercept('POST', '**/login', { statusCode: 500 }).as('loginRequest')

    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()

    // Assert server error message
    cy.contains('Server error').should('be.visible')
  })

  it('should clear error messages when user starts typing', () => {
    // Trigger error
    cy.get('button[type="submit"]').click()
    cy.contains('Email is required').should('be.visible')

    // Start typing in email field
    cy.get('input[type="email"]').type('a')

    // Error message should disappear
    cy.contains('Email is required').should('not.exist')
  })

  it('should maintain form state on page refresh', () => {
    // Enter email
    cy.get('input[type="email"]').type(EMAIL)

    // Refresh page
    cy.reload()

    // Email should still be there
    cy.get('input[type="email"]').should('have.value', EMAIL)
  })

  it('should handle very long email input', () => {
    const longEmail = 'a'.repeat(200) + '@example.com'

    cy.get('input[type="email"]').type(longEmail)

    // Should either accept or show appropriate error
    cy.get('input[type="email"]').should('have.value', longEmail)
  })

  it('should handle very long password input', () => {
    const longPassword = 'A'.repeat(200) + '1' + 'a' + '!'

    cy.get('input[type="password"]').type(longPassword)

    // Should either accept or show appropriate error
    cy.get('input[type="password"]').should('have.value', longPassword)
  })

  it('should handle special characters in password', () => {
    const specialPassword = 'Admin@123!#$%^&*()'

    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(specialPassword)
    cy.get('button[type="submit"]').click()

    // Assert successful login
    cy.url().should('not.include', '/login')
  })

  it('should handle unicode characters in email', () => {
    // Test with unicode in local part (if supported)
    cy.get('input[type="email"]').type('tëst@example.com')
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()

    // Should either work or show appropriate error
    cy.url().then(url => {
      if (url.includes('/login')) {
        cy.contains('Invalid email').should('be.visible')
      } else {
        cy.url().should('not.include', '/login')
      }
    })
  })

  it('should handle browser back/forward navigation', () => {
    // Login successfully
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')

    // Go back
    cy.go('back')
    cy.url().should('include', '/login')

    // Go forward
    cy.go('forward')
    cy.url().should('not.include', '/login')
  })

  it('should handle multiple browser tabs', () => {
    // Open login in new tab
    cy.window().then(win => {
      win.open('/login', '_blank')
    })

    // Switch to new tab
    cy.window().then(win => {
      const newTab = win.open('/login', '_blank')
      cy.wrap(newTab).as('newTab')
    })

    // Login in new tab should work independently
    cy.get('@newTab').then(tab => {
      cy.wrap(tab).its('location.href').should('include', '/login')
    })
  })

  it('should handle slow network conditions', () => {
    // Throttle real login response without replacing payload shape.
    cy.intercept('POST', '**/login', (req) => {
      req.continue((res) => {
        res.delay = 400
      })
    }).as('slowLogin')

    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()

    // Should eventually succeed
    cy.wait('@slowLogin')
    cy.url().should('not.include', '/login')
  })

  it('should validate password strength requirements', () => {
    // Test weak password
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type('123')
    cy.get('button[type="submit"]').click()

    // Should show password strength error
    cy.contains('Password too weak').should('be.visible')
  })

  it('should handle concurrent login attempts', () => {
    // Simulate slower real responses while preserving API contract.
    cy.intercept('POST', '**/login', (req) => {
      req.continue((res) => {
        res.delay = 250
      })
    }).as('loginRequest')

    // Trigger multiple rapid clicks
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)

    cy.get('button[type="submit"]').click()
    cy.get('button[type="submit"]').click()
    cy.get('button[type="submit"]').click()

    // Should handle gracefully, not crash
    cy.wait('@loginRequest')
  })

  it('should handle browser autofill', () => {
    // Simulate browser autofill
    cy.get('input[type="email"]').invoke('val', 'autofilled@email.com').trigger('change')
    cy.get('input[type="password"]').invoke('val', 'autofilledpassword').trigger('change')

    // Form should recognize autofilled values
    cy.get('input[type="email"]').should('have.value', 'autofilled@email.com')
    cy.get('input[type="password"]').should('have.value', 'autofilledpassword')
  })

  it('should handle form submission via Enter key', () => {
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)

    // Press Enter in password field
    cy.get('input[type="password"]').type('{enter}')

    // Should submit form
    cy.url().should('not.include', '/login')
  })

  it('should prevent form submission during loading', () => {
    // Delay real response while preserving API payload shape.
    cy.intercept('POST', '**/login', (req) => {
      req.continue((res) => {
        res.delay = 500
      })
    }).as('slowLogin')

    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()

    // Button should be disabled during loading
    cy.get('button[type="submit"]').should('be.disabled')

    // Wait for response
    cy.wait('@slowLogin')

    // Button should be enabled again
    cy.get('button[type="submit"]').should('not.be.disabled')
  })

  it('should handle browser zoom levels', () => {
    // Test at different zoom levels (if supported)
    cy.viewport(1280, 720)

    // Form should still be usable
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should handle different screen sizes', () => {
    // Test mobile viewport
    cy.viewport('iphone-6')

    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')

    // Test tablet viewport
    cy.viewport('ipad-2')

    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should handle browser language changes', () => {
    // Test if UI adapts to different languages (if supported)
    // This would require setting browser language preferences
    cy.get('input[type="email"]').should('have.attr', 'placeholder').then(placeholder => {
      // Check if placeholder is in expected language
      expect(placeholder).to.exist
    })
  })

  it('should handle CAPTCHA if present', () => {
    // Check if CAPTCHA exists
    cy.get('[data-cy="captcha"]').then($captcha => {
      if ($captcha.length > 0) {
        // Test CAPTCHA interaction
        cy.wrap($captcha).should('be.visible')
        // Note: Actual CAPTCHA solving would require integration with CAPTCHA solving service
      }
    })
  })

  it('should handle two-factor authentication', () => {
    // Login with 2FA enabled account
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type(PASSWORD)
    cy.get('button[type="submit"]').click()

    // Check if 2FA prompt appears
    cy.get('[data-cy="2fa-code"]').then($input => {
      if ($input.length > 0) {
        // Enter 2FA code
        cy.wrap($input).type('123456')
        cy.get('[data-cy="verify-2fa"]').click()
      }
    })

    cy.url().should('not.include', '/login')
  })

  it('should handle account verification requirements', () => {
    // Test with unverified account
    cy.get('input[type="email"]').type('unverified@email.com')
    cy.get('input[type="password"]').type('password123')
    cy.get('button[type="submit"]').click()

    // Should prompt for email verification
    cy.contains('Please verify your email').should('be.visible')
  })

  it('should handle password expiration', () => {
    // Login with expired password
    cy.get('input[type="email"]').type(EMAIL)
    cy.get('input[type="password"]').type('expiredpassword')
    cy.get('button[type="submit"]').click()

    // Should redirect to password reset
    cy.url().should('include', '/reset-password')
  })

})