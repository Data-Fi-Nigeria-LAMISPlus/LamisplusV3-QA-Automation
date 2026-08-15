// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands/ui/commands'
import './commands/api/commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// ── slow motion ─────────────────────────────────────────────────────────────
//
// Interactive runs are hard to follow: the app is fast and steps flash past
// before you can see which field was filled. This pauses briefly after each
// action so a run can be watched.
//
// Applied centrally rather than by adding cy.wait() to individual specs, so it
// covers every spec at once and never slows CI down.
//
//   cypress open  -> 1500ms per action by default (watchable)
//   cypress run   -> off by default (CI stays fast)
//   override with --env slowMo=<milliseconds>, e.g. --env slowMo=2000
//                  --env slowMo=0 turns it off in the GUI too
const configuredSlowMo = Cypress.env('slowMo')
const SLOW_MO = configuredSlowMo === undefined || configuredSlowMo === null || configuredSlowMo === ''
  ? (Cypress.config('isInteractive') ? 1500 : 0)
  : Number(configuredSlowMo)

if (SLOW_MO > 0) {
  // Delay after the command resolves, via Cypress' own promise, so the command
  // queue and the command's return value are left untouched.
  const delayBy = (ms) => (result) => Cypress.Promise.delay(ms).then(() => result)

  // Actions get the full delay - these are the steps worth watching.
  const ACTIONS = ['click', 'dblclick', 'type', 'clear', 'select', 'check', 'uncheck', 'trigger', 'visit', 'scrollIntoView']

  ACTIONS.forEach((name) => {
    Cypress.Commands.overwrite(name, (originalFn, ...args) => originalFn(...args).then(delayBy(SLOW_MO)))
  })

  // Queries (get, contains, find, first, eq...) deliberately are NOT slowed.
  // Since Cypress 12 they are query commands: Cypress.Commands.overwrite()
  // refuses them outright ("use overwriteQuery()"), and a query overwrite has to
  // return its subject synchronously, so a delay cannot be attached to one at
  // all. Attempting it fails every spec before the first assertion runs.
  //
  // There is deliberately no afterEach() pause either. Holding the page open
  // after a test finishes let the app run against a window Cypress was already
  // tearing down, which threw "Cannot read properties of null (reading
  // 'document')" - and because that surfaced inside a hook, Cypress skipped every
  // remaining test in the suite. Watchability is not worth losing a run over.
  //
  // Consequence: assertion-only specs still move quickly, because there is no
  // action in them to slow. Raise --env slowMo for the specs that fill things.
}