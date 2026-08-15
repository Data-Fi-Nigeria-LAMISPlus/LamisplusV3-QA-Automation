import { apiGet, authenticate, expectApiError, expectOk, expectPaged } from '../../support/modules/api-client'

// The core platform API: users, roles, permissions, codesets, plugins and the
// facility a session belongs to. Everything here is read-only.

describe('API - core platform', () => {
  before(() => {
    authenticate()
  })

  describe('users and roles', () => {
    it('should page through the tenant users', () => {
      expectOk('/core/api/v1/users', { qs: { page: 0, size: 10 } }).then((body) => {
        expectPaged(body, '/core/api/v1/users')
        expect(body).to.have.property('message')
      })
    })

    it('should list the assignable roles', () => {
      expectOk('/core/api/v1/roles').then((body) => {
        expect(body).to.be.an('array').and.have.length.greaterThan(0)
        expect(body[0]).to.include.keys('name')
      })
    })

    it('should list the permissions roles are built from', () => {
      expectOk('/core/api/v1/roles/permissions').then((body) => {
        expect(body).to.be.an('array').and.have.length.greaterThan(50)
      })
    })

    // A facility admin is scoped to their own facility, so the tenant-wide
    // endpoints are expected to refuse them. Asserted so that a change in the
    // permission model shows up here rather than in production.
    it('should keep tenant-wide user endpoints away from a facility admin', () => {
      ;['/core/api/v1/users/tenants', '/core/api/v1/users/get-tenant-users'].forEach((url) => {
        apiGet(url).then((response) => {
          expectApiError(response, { status: 403, code: 'INSUFFICIENT_PRIVILEGES' })
        })
      })
    })
  })

  describe('codesets', () => {
    it('should list every codeset group', () => {
      expectOk('/core/api/v1/codeset-groups/groups').then((body) => {
        expect(body).to.be.an('array').and.have.length.greaterThan(100)
      })
    })

    it('should return the members of a named group', () => {
      expectOk('/core/api/v1/codeset-groups/groups/list', { qs: { group: 'YES_NO' } }).then((body) => {
        expect(body).to.be.an('array').and.have.length.greaterThan(0)
      })
    })

    it('should page the codesets themselves', () => {
      expectOk('/core/api/v1/codesets').then((body) => {
        expect(body).to.include.keys('totalRecords', 'pageNumber', 'pageSize', 'totalPages')
      })
    })
  })

  describe('plugins and facilities', () => {
    it('should report the plugins enabled for this facility', () => {
      expectOk('/core/api/v1/plugin/my-plugins').then((body) => {
        expect(body).to.have.property('data')
        expect(body.data).to.be.an('array').and.have.length.greaterThan(0)
        expect(body.data[0]).to.include.keys('pluginId', 'isEnabled')
      })
    })

    it('should list every plugin known to the platform', () => {
      expectOk('/core/api/v1/plugin/all').then((body) => {
        expect(body).to.have.property('data')
      })
    })

    it('should name the facilities this tenant owns', () => {
      expectOk('/core/api/v1/organisation-units/tenant-facilities').then((body) => {
        expect(body).to.be.an('array').and.have.length.greaterThan(0)
      })
    })
  })
})
