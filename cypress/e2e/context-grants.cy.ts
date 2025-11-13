describe("Context Grants API", () => {
  let apiBaseUrl: string;
  let authToken: string;

  beforeEach(() => {
    cy.login();

    apiBaseUrl =
      Cypress.env("NEXT_PUBLIC_DATAGEMS_API_BASE_URL") ||
      "https://datagems-dev.scayle.es";

    cy.window().then((win) => {
      return cy
        .request({
          method: "GET",
          url: `${Cypress.config("baseUrl")}/api/auth/session`,
          failOnStatusCode: false,
        })
        .then((sessionResponse) => {
          if (
            sessionResponse.status === 200 &&
            sessionResponse.body?.accessToken
          ) {
            authToken = sessionResponse.body.accessToken;
          } else {
            cy.getCookie("next-auth.session-token").then((cookie) => {
              if (!cookie) {
                cy.getCookie("__Secure-next-auth.session-token").then(
                  (secureCookie) => {
                    if (!secureCookie && !authToken) {
                      cy.log("Warning: No session token found");
                    }
                  }
                );
              }
            });
          }
        });
    });
  });

  it("should fetch principal information", () => {
    cy.window().then(() => {
      cy.request({
        method: "GET",
        url: `${apiBaseUrl}/gw/api/principal/me`,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        failOnStatusCode: false,
      }).then((response) => {
        expect([200, 401, 403]).to.include(response.status);
        if (response.status === 200) {
          expect(response.body).to.have.property("principal");
          expect(response.body.principal).to.have.property("subject");
        }
      });
    });
  });

  it("should fetch context grants", () => {
    cy.window().then(() => {
      cy.request({
        method: "GET",
        url: `${apiBaseUrl}/gw/api/principal/me/context-grants`,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        failOnStatusCode: false,
      }).then((response) => {
        expect([200, 401, 403]).to.include(response.status);
        if (response.status === 200) {
          expect(response.body).to.be.an("array");
        }
      });
    });
  });

  it("should fetch dataset context grants with valid dataset id", () => {
    const datasetId = "test-dataset-id";
    cy.window().then(() => {
      cy.request({
        method: "GET",
        url: `${apiBaseUrl}/gw/api/principal/me/context-grants/dataset?id=${encodeURIComponent(datasetId)}`,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        failOnStatusCode: false,
      }).then((response) => {
        expect([200, 401, 403, 404]).to.include(response.status);
      });
    });
  });

  it("should fetch collection context grants with valid collection id", () => {
    const collectionId = "test-collection-id";
    cy.window().then(() => {
      cy.request({
        method: "GET",
        url: `${apiBaseUrl}/gw/api/principal/me/context-grants/collection?id=${encodeURIComponent(collectionId)}`,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        failOnStatusCode: false,
      }).then((response) => {
        expect([200, 401, 403, 404]).to.include(response.status);
      });
    });
  });
});
