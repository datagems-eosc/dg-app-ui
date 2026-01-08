describe("Delete Custom Collection", () => {
  beforeEach(() => {
    cy.login();
  });

  it("should delete a custom collection from 3 dots menu", () => {
    cy.visit("/browse");
    cy.wait(1000);

    cy.get('nav[aria-label="Collections"]').within(() => {
      cy.contains("a", "Custom").first().click();
    });

    cy.wait(1000);
    cy.url().should("include", "/collections/custom/");
    cy.get('[data-title-actions-dropdown] button').should("be.visible").click();
    cy.wait(500);
    cy.contains("button", "Delete Collection").click();

    cy.contains("h2", "Delete Collection").should("be.visible");
    cy.contains("p", /This operation will permanently delete/).should("be.visible");
    cy.contains("button", "Delete").last().click();

    cy.contains("Collection deleted successfully!", { timeout: 10000 }).should(
      "be.visible",
    );

    cy.url().should("include", "/browse");
  });

  it("should show error toast when deletion fails", () => {
    cy.visit("/browse");
    cy.wait(1000);

    cy.intercept("DELETE", "**/collection/**", {
      statusCode: 500,
      body: { error: "Internal server error" },
    }).as("deleteCollectionError");

    cy.get('nav[aria-label="Collections"]').within(() => {
      cy.contains("a", "Custom").first().click();
    });

    cy.wait(1000);
    cy.url().should("include", "/collections/custom/");
    cy.get('[data-title-actions-dropdown] button').should("be.visible").click();
    cy.wait(500);
    cy.contains("button", "Delete Collection").click();
    cy.contains("button", "Delete").last().click();

    cy.wait("@deleteCollectionError");
    cy.contains("Failed to delete collection", { timeout: 10000 }).should(
      "be.visible",
    );
  });

  it("should not show 3 dots menu for non-custom collections", () => {
    cy.visit("/collections/math");
    cy.wait(1000);

    cy.get('[data-title-actions-dropdown]').should("not.exist");
  });

  it("should not show Delete Collection button without dg_col-delete grant", () => {
    cy.intercept("GET", "**/principal/me/context-grants/collection**", {
      statusCode: 200,
      body: { grants: [] },
    }).as("getGrants");

    cy.visit("/browse");
    cy.wait(1000);

    cy.get('nav[aria-label="Collections"]').within(() => {
      cy.contains("a", "Custom").first().click();
    });

    cy.wait(1000);
    cy.wait("@getGrants");
    cy.url().should("include", "/collections/custom/");
    cy.get('[data-title-actions-dropdown] button').should("be.visible").click();
    cy.wait(500);
    
    cy.contains("button", "Select All").should("be.visible");
    cy.contains("button", "Rename").should("be.visible");
    cy.contains("button", "Delete").should("be.visible");
    cy.contains("button", "Delete Collection").should("not.exist");
  });

  it("should allow canceling deletion", () => {
    cy.visit("/browse");
    cy.wait(1000);

    cy.get('nav[aria-label="Collections"]').within(() => {
      cy.contains("a", "Custom").first().click();
    });

    cy.wait(1000);
    cy.url().should("include", "/collections/custom/");
    cy.get('[data-title-actions-dropdown] button').should("be.visible").click();
    cy.wait(500);
    cy.contains("button", "Delete Collection").click();

    cy.contains("h2", "Delete Collection").should("be.visible");
    cy.contains("button", "Cancel").click();

    cy.url().should("include", "/collections/custom/");
    cy.get('[data-title-actions-dropdown] button').should("be.visible");
  });
});
