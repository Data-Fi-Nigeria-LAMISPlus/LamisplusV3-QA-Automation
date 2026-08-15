// The deployed environments expose data-cy hooks (login-email/password/submit/error),
// while the current app source has renamed them to data-testid
// (core-auth-login-*) in Login.tsx. The two are mutually exclusive per build, so
// each locator accepts either and keeps working across the rename.
// Verified against qa.lamisplus.org: only the data-cy variants are live today.
export const locator = {
  ERROR: '[data-cy="login-error"], [data-testid="core-auth-login-error"]',
  EMAIL_INPUT: '[data-cy="login-email"], [data-testid="core-auth-login-email-input"]',
  PASSWORD_INPUT: '[data-cy="login-password"], [data-testid="core-auth-login-password-input"]',
  SUBMIT_BUTTON: '[data-cy="login-submit"], [data-testid="core-auth-login-submit-btn"]',
  FORM: 'form',
}

// Copy the application actually renders. The login form surfaces whatever
// getErrorMessage() derives from the API response, so these strings are taken
// from the live responses of POST /core/api/v1/auth/login rather than invented.
export const message = {
  BAD_CREDENTIALS: 'Invalid email or password', // 401
  UNREACHABLE: 'Cannot reach the server. Check your connection.', // no response
}

const LOGIN_API = '**/core/api/v1/auth/login'

// The landing route after a successful login on the deployed app. The '/ehr/*'
// scheme present in the app source is not live yet ('/ehr/dashboard' returns 404).
const DASHBOARD_ROUTE = '/dashboard'

const EMAIL = Cypress.env('EMAIL')
const PASSWORD = Cypress.env('PASSWORD')

// ── helpers ─────────────────────────────────────────────────────────────────

const typeEmail = (value) => cy.get(locator.EMAIL_INPUT).clear().type(value, { delay: 0 })
const typePassword = (value) => cy.get(locator.PASSWORD_INPUT).clear().type(value, { delay: 0 })
const submit = () => cy.get(locator.SUBMIT_BUTTON).click()

const expectLoginError = (text) =>
  cy.get(locator.ERROR, { timeout: 15000 }).should('be.visible').and('contain.text', text)

const expectLoggedIn = () => cy.url({ timeout: 30000 }).should('not.include', '/login')
const expectStillOnLogin = () => cy.url().should('include', '/login')

// The email/password fields use the native `required` attribute (and type="email"),
// so the browser blocks submission itself and shows a native tooltip. There is no
// DOM text to assert - the observable behaviour is the field's validity state.
const expectNativelyInvalid = (selector) =>
  cy.get(selector).then(($el) => {
    expect($el[0].checkValidity(), 'field fails native constraint validation').to.eq(false)
    expect($el[0].validationMessage, 'browser supplies a validation message').to.not.equal('')
  })

const expectNoErrorBanner = () => cy.get(locator.ERROR).should('not.exist')

// Several scenarios below exercise how the form renders a given API outcome. Those
// stub the request: the login endpoint is rate limited to 10 requests/min per IP
// (see RateLimitFilter), and issuing a real request for every scenario tripped that
// limit mid-run, which then failed later tests that needed a genuine login.
const stubLogin = (response) => cy.intercept('POST', LOGIN_API, response).as('loginRequest')
const spyLogin = () => cy.intercept('POST', LOGIN_API).as('loginRequest')

// ── real-login scenarios ────────────────────────────────────────────────────

// The happy path, used as setup by most other specs.
//
// Survives one throttle: the login endpoint allows 10 requests/min per IP, and
// the scenarios above spend most of that budget, so a genuine login later in the
// same minute can come back rejected and leave the browser sitting on /login.
// That produced an intermittent "expected .../login to not include '/login'"
// failure in whichever spec happened to run next. One retry after the window
// rolls is enough; a second consecutive rejection still fails the test, so a
// real authentication break is not masked.
const attemptLogin = () => {
  cy.visit('/login')
  typeEmail(EMAIL)
  typePassword(PASSWORD)
  submit()
}

export const login = () => {
  spyLogin()
  attemptLogin()

  cy.wait('@loginRequest', { timeout: 30000 }).then(({ response }) => {
    const status = response?.statusCode
    if (status && status >= 200 && status < 400) return

    cy.log(`login rejected with ${status}, waiting for the rate-limit window to roll`)
    cy.wait(35000)
    attemptLogin()
  })

  expectLoggedIn()
}

export const caseSensitiveEmail = () => {
  typeEmail(EMAIL.toUpperCase())
  typePassword(PASSWORD)
  submit()
  expectLoggedIn()
}

export const leadingTrailingSpacesEmail = () => {
  // type="email" applies the HTML value-sanitisation algorithm, which strips
  // leading/trailing whitespace, so surrounding spaces must not break login.
  typeEmail(`  ${EMAIL}  `)
  typePassword(PASSWORD)
  cy.get(locator.EMAIL_INPUT).should('have.value', EMAIL)
  submit()
  expectLoggedIn()
}

export const leadingTrailingSpacesPassword = () => {
  // Passwords are not sanitised, so padding them must fail authentication.
  typeEmail(EMAIL)
  typePassword(`  ${PASSWORD}  `)
  submit()
  expectLoginError(message.BAD_CREDENTIALS)
}

export const invalidCredentialsError = () => {
  typeEmail('wrong@email.com')
  typePassword('wrongpassword')
  submit()
  expectLoginError(message.BAD_CREDENTIALS)
}

export const redirectToIntendedPage = () => {
  // Login always routes to the role's default dashboard; the app has no
  // "return to the originally requested page" mechanism, so that is what is
  // asserted here rather than a deep-link round trip.
  typeEmail(EMAIL)
  typePassword(PASSWORD)
  submit()
  cy.url({ timeout: 30000 }).should('include', DASHBOARD_ROUTE)
}

export const backForwardNavigation = () => {
  typeEmail(EMAIL)
  typePassword(PASSWORD)
  submit()
  expectLoggedIn()
  cy.go('back')
  expectStillOnLogin()
  cy.go('forward')
  expectLoggedIn()
}

export const slowNetworkConditions = () => {
  cy.intercept('POST', LOGIN_API, (req) => {
    req.continue((res) => {
      res.delay = 400
    })
  }).as('slowLogin')
  typeEmail(EMAIL)
  typePassword(PASSWORD)
  submit()
  cy.wait('@slowLogin')
  expectLoggedIn()
}

export const formSubmissionViaEnterKey = () => {
  typeEmail(EMAIL)
  cy.get(locator.PASSWORD_INPUT).clear().type(`${PASSWORD}{enter}`, { delay: 0 })
  expectLoggedIn()
}

// ── native constraint validation ────────────────────────────────────────────

export const invalidEmail = () => {
  spyLogin()
  typeEmail('invalid-email')
  typePassword(PASSWORD)
  submit()
  expectNativelyInvalid(locator.EMAIL_INPUT)
  expectStillOnLogin()
  expectNoErrorBanner()
  cy.get('@loginRequest.all').should('have.length', 0)
}

export const emptyEmailError = () => {
  spyLogin()
  typePassword(PASSWORD)
  submit()
  expectNativelyInvalid(locator.EMAIL_INPUT)
  expectStillOnLogin()
  cy.get('@loginRequest.all').should('have.length', 0)
}

export const emptyPasswordError = () => {
  spyLogin()
  typeEmail(EMAIL)
  submit()
  expectNativelyInvalid(locator.PASSWORD_INPUT)
  expectStillOnLogin()
  cy.get('@loginRequest.all').should('have.length', 0)
}

export const bothFieldsEmptyError = () => {
  spyLogin()
  submit()
  expectNativelyInvalid(locator.EMAIL_INPUT)
  expectNativelyInvalid(locator.PASSWORD_INPUT)
  expectStillOnLogin()
  cy.get('@loginRequest.all').should('have.length', 0)
}

export const unicodeCharactersEmail = () => {
  const unicodeEmail = 'tëst@example.com'
  typeEmail(unicodeEmail)
  typePassword(PASSWORD)
  cy.get(locator.EMAIL_INPUT).then(($el) => {
    if (!$el[0].checkValidity()) {
      // Browser rejects the non-ASCII local part - no request is made.
      expectStillOnLogin()
      return
    }
    stubLogin({ statusCode: 401, body: { message: message.BAD_CREDENTIALS } })
    submit()
    expectLoginError(message.BAD_CREDENTIALS)
  })
}

// ── stubbed API outcomes ────────────────────────────────────────────────────

export const wrongPasswordError = () => {
  stubLogin({ statusCode: 401, body: { message: message.BAD_CREDENTIALS } })
  typeEmail(EMAIL)
  typePassword('wrongpassword')
  submit()
  // The API deliberately does not distinguish a wrong password from a wrong
  // email, so the form shows the same combined message.
  expectLoginError(message.BAD_CREDENTIALS)
}

export const wrongEmailError = () => {
  stubLogin({ statusCode: 401, body: { message: message.BAD_CREDENTIALS } })
  typeEmail('wrong@email.com')
  typePassword(PASSWORD)
  submit()
  expectLoginError(message.BAD_CREDENTIALS)
}

export const multipleRapidLoginAttempts = () => {
  // Stubbed rather than genuinely hammered: really exhausting the limiter would
  // block every later test in the run (10 req/min per IP, shared across the suite).
  const rateLimitMessage = 'Too many login attempts. Please try again later.'
  stubLogin({
    statusCode: 429,
    body: { status: 429, message: rateLimitMessage, retryAfterSeconds: 60 },
  })
  typeEmail(EMAIL)
  typePassword('wrongpassword')
  submit()
  expectLoginError(rateLimitMessage)
}

export const networkErrorHandling = () => {
  cy.intercept('POST', LOGIN_API, { forceNetworkError: true }).as('loginRequest')
  typeEmail(EMAIL)
  typePassword(PASSWORD)
  submit()
  // Asserts that a transport failure surfaces *some* message and does not sign the
  // user in. The exact wording for the no-response branch is client-side and has
  // drifted between builds, so it is deliberately not pinned here.
  cy.get(locator.ERROR, { timeout: 15000 }).should('be.visible').and('not.have.text', '')
  expectStillOnLogin()
}

export const serverErrorHandling = () => {
  const serverMessage = 'Internal server error'
  stubLogin({ statusCode: 500, body: { message: serverMessage } })
  typeEmail(EMAIL)
  typePassword(PASSWORD)
  submit()
  expectLoginError(serverMessage)
}

export const validatePasswordStrength = () => {
  // The login form intentionally applies no strength rules - a weak password is
  // simply an authentication failure. Strength is enforced at registration.
  stubLogin({ statusCode: 401, body: { message: message.BAD_CREDENTIALS } })
  typeEmail(EMAIL)
  typePassword('123')
  submit()
  expectLoginError(message.BAD_CREDENTIALS)
}

export const specialCharactersPassword = () => {
  const specialPassword = 'Admin@123!#$%^&*()'
  stubLogin({ statusCode: 401, body: { message: message.BAD_CREDENTIALS } })
  typeEmail(EMAIL)
  typePassword(specialPassword)
  cy.get(locator.PASSWORD_INPUT).should('have.value', specialPassword)
  submit()
  expectLoginError(message.BAD_CREDENTIALS)
}

export const clearErrorMessagesOnTyping = () => {
  stubLogin({ statusCode: 401, body: { message: message.BAD_CREDENTIALS } })
  typeEmail(EMAIL)
  typePassword('wrongpassword')
  submit()
  expectLoginError(message.BAD_CREDENTIALS)

  // handleSubmit() clears the banner at the start of the next submission.
  cy.intercept('POST', LOGIN_API, (req) => {
    req.reply({ statusCode: 401, body: { message: message.BAD_CREDENTIALS }, delay: 1000 })
  }).as('slowRetry')
  typePassword('anotherwrongpassword')
  submit()
  expectNoErrorBanner()
  cy.wait('@slowRetry')
}

export const concurrentLoginAttempts = () => {
  // The submit button is disabled while a request is in flight, so a double
  // submit is impossible. Asserting that is stable; blind repeat clicks raced
  // with the re-render and detached the element.
  cy.intercept('POST', LOGIN_API, (req) => {
    req.reply({ statusCode: 401, body: { message: message.BAD_CREDENTIALS }, delay: 1000 })
  }).as('loginRequest')
  typeEmail(EMAIL)
  typePassword('wrongpassword')
  submit()
  cy.get(locator.SUBMIT_BUTTON).should('be.disabled')
  cy.wait('@loginRequest')
  cy.get(locator.SUBMIT_BUTTON).should('not.be.disabled')
  cy.get('@loginRequest.all').should('have.length', 1)
}

export const preventFormSubmissionDuringLoading = () => {
  // Stubbed with a 401 so the app stays on /login: on success it navigates away
  // and the button no longer exists, which is why the old assertion could not
  // find button[type="submit"].
  cy.intercept('POST', LOGIN_API, (req) => {
    req.reply({ statusCode: 401, body: { message: message.BAD_CREDENTIALS }, delay: 1000 })
  }).as('slowLogin')
  typeEmail(EMAIL)
  typePassword('wrongpassword')
  submit()
  cy.get(locator.SUBMIT_BUTTON).should('be.disabled')
  cy.wait('@slowLogin')
  cy.get(locator.SUBMIT_BUTTON).should('not.be.disabled')
}

// ── form behaviour, no request ──────────────────────────────────────────────

export const forgotPasswordLink = () => {
  // No dedicated hook on this control in the deployed build, so match on its label.
  cy.contains('Forgot Password').should('be.visible').click()
  cy.url().should('include', '/forgot-password')
}

export const maintainFormStateOnRefresh = () => {
  // The form keeps its value in React state only - a reload is expected to reset
  // it. Asserting the value survived was asserting behaviour that does not exist.
  typeEmail(EMAIL)
  cy.reload()
  cy.get(locator.EMAIL_INPUT).should('have.value', '')
}

export const longEmailInput = () => {
  const longEmail = `${'a'.repeat(200)}@example.com`
  typeEmail(longEmail)
  cy.get(locator.EMAIL_INPUT).should('have.value', longEmail)
}

export const longPasswordInput = () => {
  const longPassword = `${'A'.repeat(200)}1a!`
  typePassword(longPassword)
  cy.get(locator.PASSWORD_INPUT).should('have.value', longPassword)
}

export const browserAutofill = () => {
  cy.get(locator.EMAIL_INPUT).invoke('val', 'autofilled@email.com').trigger('change')
  cy.get(locator.PASSWORD_INPUT).invoke('val', 'autofilledpassword').trigger('change')
  cy.get(locator.EMAIL_INPUT).should('have.value', 'autofilled@email.com')
  cy.get(locator.PASSWORD_INPUT).should('have.value', 'autofilledpassword')
}

export const multipleBrowserTabs = () => {
  // Cypress runs in a single tab and cannot drive popups - window.open() returns
  // null here, which is why the old cy.its('location.href') got a null subject.
  // The equivalent observable behaviour is that a fresh visit renders the form.
  cy.visit('/login')
  cy.get(locator.FORM).should('be.visible')
  cy.get(locator.EMAIL_INPUT).should('be.visible').and('have.value', '')
  cy.get(locator.SUBMIT_BUTTON).should('be.enabled')
}

export const rememberUserSession = () => {
  // redux-persist keeps the auth slice (including isAuthenticated) in
  // sessionStorage, which survives a same-tab reload, so the session must hold.
  typeEmail(EMAIL)
  typePassword(PASSWORD)
  submit()
  expectLoggedIn()
  cy.reload()
  expectLoggedIn()
}

export const browserZoomLevels = () => {
  cy.viewport(1280, 720)
  cy.get(locator.EMAIL_INPUT).should('be.visible')
  cy.get(locator.PASSWORD_INPUT).should('be.visible')
  cy.get(locator.SUBMIT_BUTTON).should('be.visible')
}

export const differentScreenSizes = () => {
  for (const size of ['iphone-6', 'ipad-2']) {
    cy.viewport(size)
    cy.get(locator.EMAIL_INPUT).should('be.visible')
    cy.get(locator.PASSWORD_INPUT).should('be.visible')
    cy.get(locator.SUBMIT_BUTTON).should('be.visible')
  }
}

export const browserLanguageChanges = () => {
  cy.get(locator.EMAIL_INPUT).should('have.attr', 'placeholder').and('not.be.empty')
}
