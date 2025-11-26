describe("Delete Custom Collection", () => {
  beforeEach(() => {
    cy.login();
  });

  it("should delete a custom collection from 3 dots menu", () => {
    cy.visit("/dashboard");
    cy.wait(1000);

    cy.get('nav[aria-label="Collections"]').within(() => {
      cy.contains("a", "Custom").first().click();
    });

    cy.wait(1000);
    cy.url().should("include", "/collections/custom/");
    cy.get('[data-title-actions-dropdown] button').should("be.visible").click();
    cy.wait(500);
    cy.contains("button", "Delete").click();

    cy.contains("h2", "Delete Collection").should("be.visible");
    cy.contains("p", /Are you sure you want to delete/).should("be.visible");
    cy.contains("button", "Delete").last().click();

    cy.contains("Collection deleted successfully!", { timeout: 10000 }).should(
      "be.visible",
    );

    cy.url().should("include", "/dashboard");
  });

  it("should show error toast when deletion fails", () => {
    cy.visit("/dashboard");
    cy.wait(1000);

    cy.intercept("DELETE", "**/user/collection/**", {
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
    cy.contains("button", "Delete").click();
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

  it("should allow canceling deletion", () => {
    cy.visit("/dashboard");
    cy.wait(1000);

    cy.get('nav[aria-label="Collections"]').within(() => {
      cy.contains("a", "Custom").first().click();
    });

    cy.wait(1000);
    cy.url().should("include", "/collections/custom/");
    cy.get('[data-title-actions-dropdown] button').should("be.visible").click();
    cy.wait(500);
    cy.contains("button", "Delete").click();

    cy.contains("h2", "Delete Collection").should("be.visible");
    cy.contains("button", "Cancel").click();

    cy.url().should("include", "/collections/custom/");
    cy.get('[data-title-actions-dropdown] button').should("be.visible");
  });
});
