import { apiGet, authenticate, expectOk } from '../../support/modules/api-client'

// Authentication and the identity endpoints behind it.
//
// The login endpoint is rate limited to 10 requests per minute per IP, so the
// negative cases below are deliberately few - each one spends from that budget,
// and exhausting it makes every later spec in the run fail to sign in.

describe('API - authentication', () => {
  before(() => {
    authenticate()
  })

  it('should issue a token for valid credentials', () => {
    expect(Cypress.env('accessToken'), 'cached token').to.be.a('string').and.not.be.empty
  })

  it('should describe the signed-in user', () => {
    expectOk('/core/api/v1/users/me').then((body) => {
      expect(body).to.include.keys('email', 'firstName', 'fullName', 'enabled')
      expect(body.email).to.eq(Cypress.env('EMAIL'))
      expect(body.enabled, 'account is enabled').to.eq(true)
    })
  })

  it('should carry the signed-in user through to their settings', () => {
    expectOk('/core/api/v1/user-settings').then((body) => {
      expect(body).to.include.keys('id', 'firstName', 'lastName')
    })
  })

  it('should refuse a request with no token', () => {
    cy.request({
      method: 'GET',
      url: '/core/api/v1/users/me',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status, 'unauthenticated request').to.be.oneOf([401, 403])
    })
  })

  it('should refuse a request with a token that is not ours', () => {
    apiGet('/core/api/v1/users/me', {
      headers: { Authorization: 'Bearer not.a.real.token' },
    }).then((response) => {
      expect(response.status, 'forged token').to.be.oneOf([401, 403])
    })
  })
})
