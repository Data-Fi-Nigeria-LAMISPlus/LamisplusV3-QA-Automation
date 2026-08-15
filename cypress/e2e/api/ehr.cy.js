import { authenticate, expectOk, expectPaged } from '../../support/modules/api-client'

// The EHR plugin: patients, the service points they are routed through, and the
// clinical catalogues the forms are built from.

describe('API - EHR', () => {
  before(() => {
    authenticate()
  })

  describe('patients', () => {
    it('should page the patient register', () => {
      expectOk('/plugin/ehr/api/v1/patient', { qs: { page: 0, size: 10 } }).then((body) => {
        expectPaged(body, '/plugin/ehr/api/v1/patient')
        expect(body.data).to.include.keys('totalItems', 'patients')
        expect(body.data.patients).to.be.an('array')
      })
    })

    it('should respect the page size it is asked for', () => {
      expectOk('/plugin/ehr/api/v1/patient', { qs: { page: 0, size: 3 } }).then((body) => {
        expect(body.data.patients.length, 'page of 3').to.be.at.most(3)
      })
    })

    it('should return an empty page past the end of the register', () => {
      expectOk('/plugin/ehr/api/v1/patient', { qs: { page: 9999, size: 10 } }).then((body) => {
        expect(body.data.patients, 'page beyond the last').to.be.an('array').and.have.length(0)
      })
    })
  })

  describe('service points and locations', () => {
    it('should list the service points patients are posted to', () => {
      expectOk('/plugin/ehr/api/v1/service-points', { qs: { size: 100 } }).then((body) => {
        expect(body).to.have.property('content')
        expect(body.content).to.be.an('array').and.have.length.greaterThan(0)

        // The public health flows depend on these two existing by name.
        const names = body.content.map((point) => String(point.name ?? point.servicePointName ?? '').toUpperCase())
        expect(names.join(','), 'immunization service point').to.match(/IMMUNIZATION/)
        expect(names.join(','), 'family planning service point').to.match(/FAMILY[_ ]?PLANNING/)
      })
    })

    it('should list the facility locations', () => {
      expectOk('/plugin/ehr/api/v1/service-locations').then((body) => {
        expect(body).to.have.property('content')
      })
    })
  })

  describe('clinical catalogues', () => {
    it('should list the lab tests that can be ordered', () => {
      expectOk('/plugin/ehr/api/v1/lab-test').then((body) => {
        expect(body).to.be.an('array').and.have.length.greaterThan(0)
      })
    })

    it('should list the specimen types', () => {
      expectOk('/plugin/ehr/api/v1/lab-sample-types').then((body) => {
        expect(body).to.be.an('array').and.have.length.greaterThan(0)
      })
    })

    it('should group the lab tests', () => {
      expectOk('/plugin/ehr/api/v1/lab-test_group').then((body) => {
        expect(body).to.be.an('array').and.have.length.greaterThan(0)
      })
    })

    it('should page the drug catalogue', () => {
      expectOk('/plugin/ehr/api/v1/drug', { qs: { page: 0, size: 10 } }).then((body) => {
        expectPaged(body, '/plugin/ehr/api/v1/drug')
      })
    })
  })

  describe('orders and encounters', () => {
    it('should page the laboratory orders', () => {
      expectOk('/plugin/ehr/api/v1/lab-orders').then((body) => {
        expect(body).to.include.keys('totalRecords', 'pageNumber', 'pageSize', 'totalPages')
      })
    })

    it('should summarise prescription orders', () => {
      expectOk('/plugin/ehr/api/v1/drug-orders/prescription-order-information').then((body) => {
        expect(body).to.be.an('array')
      })
    })

    it('should page the encounters', () => {
      expectOk('/plugin/ehr/api/v1/encounter').then((body) => {
        expectPaged(body, '/plugin/ehr/api/v1/encounter')
      })
    })

    it('should list the patients eligible for hepatitis screening', () => {
      expectOk('/plugin/ehr/api/lab-order-result/hepatitis-eligibles').then((body) => {
        expect(body).to.include.keys('totalRecords', 'totalPages')
      })
    })
  })
})
