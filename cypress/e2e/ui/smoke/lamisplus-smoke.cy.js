import {
  login,
  invalidEmail,
  emptyEmailError,
  emptyPasswordError,
  bothFieldsEmptyError,
  invalidCredentialsError,
  wrongPasswordError,
  wrongEmailError,
  caseSensitiveEmail,
  leadingTrailingSpacesEmail,
  leadingTrailingSpacesPassword,
  multipleRapidLoginAttempts,
  forgotPasswordLink,
  rememberUserSession,
  redirectToIntendedPage,
  networkErrorHandling,
  serverErrorHandling,
  clearErrorMessagesOnTyping,
  maintainFormStateOnRefresh,
  longEmailInput,
  longPasswordInput,
  specialCharactersPassword,
  unicodeCharactersEmail,
  backForwardNavigation,
  multipleBrowserTabs,
  slowNetworkConditions,
  validatePasswordStrength,
  concurrentLoginAttempts,
  browserAutofill,
  formSubmissionViaEnterKey,
  preventFormSubmissionDuringLoading,
} from "../../../support/modules/login";
import { patientRegistration } from "../../../support/modules/patient-flow";

const loginScenarios = [
  { name: "should login successfully with valid credentials", run: login },
  { name: "should show invalid email error", run: invalidEmail },
  { name: "should show email required error", run: emptyEmailError },
  { name: "should show password required error", run: emptyPasswordError },
  { name: "should show both required field errors", run: bothFieldsEmptyError },
  { name: "should show invalid credentials error", run: invalidCredentialsError },
  { name: "should show wrong password error", run: wrongPasswordError },
  { name: "should show wrong email error", run: wrongEmailError },
  { name: "should handle case-sensitive email input", run: caseSensitiveEmail },
  { name: "should handle leading/trailing spaces in email", run: leadingTrailingSpacesEmail },
  { name: "should fail with leading/trailing spaces in password", run: leadingTrailingSpacesPassword },
  { name: "should limit multiple rapid login attempts", run: multipleRapidLoginAttempts },
  { name: "should navigate to forgot password page", run: forgotPasswordLink },
  { name: "should remember user session after reload", run: rememberUserSession },
  { name: "should redirect to intended page after login", run: redirectToIntendedPage },
  { name: "should handle network errors", run: networkErrorHandling },
  { name: "should handle server errors", run: serverErrorHandling },
  { name: "should clear error message on typing", run: clearErrorMessagesOnTyping },
  { name: "should maintain form state on refresh", run: maintainFormStateOnRefresh },
  { name: "should accept long email input", run: longEmailInput },
  { name: "should accept long password input", run: longPasswordInput },
  { name: "should handle special characters in password", run: specialCharactersPassword },
  { name: "should handle unicode characters in email", run: unicodeCharactersEmail },
  { name: "should handle browser back/forward navigation", run: backForwardNavigation },
  { name: "should handle multiple browser tabs", run: multipleBrowserTabs },
  { name: "should handle slow network conditions", run: slowNetworkConditions },
  { name: "should validate weak password handling", run: validatePasswordStrength },
  { name: "should handle concurrent login attempts", run: concurrentLoginAttempts },
  { name: "should support browser autofill", run: browserAutofill },
  { name: "should submit login form with enter key", run: formSubmissionViaEnterKey },
  { name: "should prevent form submit during loading", run: preventFormSubmissionDuringLoading },
];

describe("Login Scenarios", () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit("/login");
  });

  loginScenarios.forEach(({ name, run }) => {
    it(name, () => {
      run();
    });
  });
});

describe("Patient Registration", () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    login();
  });
  it("should register a patient successfully with valid details", () => {
    patientRegistration();
  });
});


