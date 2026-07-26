export const getGeneralDashboard = () => {
  return cy
    .request({
      method: "Get",
      url: "/plugin/ehr/api/v1/consultation/general-dashboard",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Authorization: `Bearer ${Cypress.env("accessToken")}`,
      },
    })
    .then((res) => {
      expect(res.status).to.eq(200);
      expect(res.statusText).to.eq("OK");
      const data = res.body;
      const monthsStats = data.monthsStats;
      expect(monthsStats).to.be.an("array");
      expect(monthsStats.length).to.be.greaterThan(0);
      expect(monthsStats[0]).to.have.property("monthName");
      expect(monthsStats[0]).to.have.property("numberOfOutpatient");
      const totalStats = data.totalStats;
      expect(totalStats).to.have.property("totalNumberOfpatients");
      const totalByAgeSegregation = data.totalByAgeSegregation;
      expect(totalByAgeSegregation).to.be.an("object");
    });
};

export const getPatientManagement = () => {
  return cy
    .request({
      method: "Get",
      url: "/plugin/ehr/api/v1/patient",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Authorization: `Bearer ${Cypress.env("accessToken")}`,
      },
      qs: {
        page: 0,
        size: 10,
      },
    })
    .then((res) => {
      expect(res.status).to.eq(200);
      expect(res.statusText).to.eq("OK");
      const bodyResponse = res.body;
      expect(bodyResponse.data).to.have.property("totalItems");
      expect(bodyResponse.data).to.have.property("patients");
      expect(bodyResponse).to.have.property("message");
    });
};
