// Shared client for the API specs.
//
// Every request goes through here so that authentication, headers and the
// "don't fail on a non-2xx" behaviour are consistent: several specs deliberately
// assert 400/403/503 responses, and cy.request's default of failing on those
// would turn a documented defect into a red test.
//
// Login is rate limited to 10 requests per minute per IP, so the token is
// fetched once per spec file in a before() hook and cached in Cypress.env.

export const TOKEN_KEY = "accessToken";

export const authHeaders = () => ({
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  Authorization: `Bearer ${Cypress.env(TOKEN_KEY)}`,
});

// Signs in and caches the token. Asserts the shape of what comes back, because
// every other spec depends on it.
export const authenticate = () =>
  cy
    .request({
      method: "POST",
      url: "/core/api/v1/auth/login",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: { email: Cypress.env("EMAIL"), password: Cypress.env("PASSWORD") },
    })
    .then((response) => {
      expect(response.status, "login").to.eq(200);
      expect(response.body.accessToken, "access token").to.be.a("string").and.not.be.empty;
      Cypress.env(TOKEN_KEY, response.body.accessToken);
      return response.body.accessToken;
    });

// A GET that never fails on status - the caller decides what is acceptable.
export const apiGet = (url, { qs, headers } = {}) =>
  cy.request({
    method: "GET",
    url,
    qs,
    headers: { ...authHeaders(), ...headers },
    failOnStatusCode: false,
  });

// The common case: expect a 200 and hand back the body.
export const expectOk = (url, options = {}) =>
  apiGet(url, options).then((response) => {
    expect(response.status, `GET ${url}`).to.eq(200);
    return response.body;
  });

// Asserts a paged envelope in whichever of the three shapes this API uses:
//   { totalRecords, pageNumber, pageSize, totalPages, records|data }
//   { statusCode, message, data: { ... } }
//   { content, page }
export const expectPaged = (body, url) => {
  const shapes = [
    () => expect(body).to.have.property("totalRecords"),
    () => expect(body).to.have.property("data"),
    () => expect(body).to.have.property("content"),
  ];

  const matched = shapes.some((assertShape) => {
    try {
      assertShape();
      return true;
    } catch {
      return false;
    }
  });

  expect(matched, `${url} returns a recognised paged envelope, got keys [${Object.keys(body ?? {})}]`).to.equal(true);
};

// The API reports failures as an array of { code, field, message }.
export const expectApiError = (response, { status, code }) => {
  expect(response.status, "status").to.eq(status);
  const [error] = Array.isArray(response.body) ? response.body : [response.body];
  expect(error, "error body").to.be.an("object");
  expect(error.code, "error code").to.eq(code);
  return error;
};
