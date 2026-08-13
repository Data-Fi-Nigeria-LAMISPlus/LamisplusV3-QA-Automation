import { getGeneralDashboard, getPatientManagement } from "../../support/modules/api-get-request"
import { postLogin } from "../../support/modules/api-post-request"

describe('Login user - Basic Authentication', () => {
    // One login per spec run. postLogin() asserts the 200/OK and caches the token
    // in Cypress.env, and /core/api/v1/auth/login is rate limited to 10 req/min
    // per IP, so re-authenticating before every test wastes that budget.
    before(() => {
        postLogin()
    })

  it('should login successfully with valid credentials', () => {
   expect(Cypress.env('accessToken')).to.be.a('string').and.not.be.empty
  })
  it('should Load General Dashboard successfully', () => {
   getGeneralDashboard()
  })
  it('should Load Patient Management successfully', () => {
   getPatientManagement()
  })
})
