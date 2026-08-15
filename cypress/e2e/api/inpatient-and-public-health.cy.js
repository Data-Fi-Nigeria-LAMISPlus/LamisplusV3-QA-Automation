import { apiGet, authenticate, expectApiError, expectOk } from '../../support/modules/api-client'

// The inpatient and public health plugins.

const PAGED_KEYS = ['totalRecords', 'pageNumber', 'pageSize', 'totalPages']

describe('API - inpatient and public health', () => {
  before(() => {
    authenticate()
  })

  describe('inpatient', () => {
    ;[
      ['wards', '/plugin/inpatient/api/v1/wards'],
      ['beds', '/plugin/inpatient/api/v1/beds'],
      ['admissions', '/plugin/inpatient/api/v1/admissions'],
      ['discharges', '/plugin/inpatient/api/v1/discharges'],
    ].forEach(([name, url]) => {
      it(`should page the ${name}`, () => {
        expectOk(url).then((body) => {
          expect(body).to.include.keys(...PAGED_KEYS)
          expect(body.totalRecords, `${name} count`).to.be.a('number')
        })
      })
    })

    it('should have at least one ward and one bed to admit into', () => {
      expectOk('/plugin/inpatient/api/v1/wards').then((wards) => {
        expect(wards.totalRecords, 'wards configured').to.be.greaterThan(0)
      })
      expectOk('/plugin/inpatient/api/v1/beds').then((beds) => {
        expect(beds.totalRecords, 'beds configured').to.be.greaterThan(0)
      })
    })
  })

  describe('public health', () => {
    it('should list the family planning enrolments', () => {
      expectOk('/plugin/pbh/api/v1/family-planning').then((body) => {
        expect(body).to.be.an('array')
      })
    })

    // Records a defect. The hepatitis endpoints answer 503 on this environment -
    // the same response the viral hepatitis UI spec documents when saving an
    // enrolment. When the feature is switched on these will fail; expect 200 then.
    ;[
      ['enrolments', '/plugin/pbh/api/v1/hepatitis_enrollment'],
      ['follow-ups', '/plugin/pbh/api/v1/hepatitis_followup'],
    ].forEach(([name, url]) => {
      it(`should report hepatitis ${name} as unavailable (feature switched off)`, () => {
        apiGet(url).then((response) => {
          expectApiError(response, { status: 503, code: 'SERVICE_UNAVAILABLE' })
        })
      })
    })
  })
})
