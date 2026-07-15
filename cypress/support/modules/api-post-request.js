const email = Cypress.env('EMAIL')
const password = Cypress.env('PASSWORD')
export const postLogin = () => {
  const requestBody = {
        email: email,
        password: password
      };
  return cy
    .request({
      method: "Post",
      url: "/core/api/v1/auth/login",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      body: requestBody
    })
    .then((res) => {
      expect(res.status).to.eq(200)
      expect(res.statusText).to.eq("OK")
      const token = res.body.accessToken
      Cypress.env('accessToken', token)
    });
};
