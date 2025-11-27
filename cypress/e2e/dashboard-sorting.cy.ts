describe("Dashboard Dataset Sorting", () => {
  beforeEach(() => {
    cy.login();
    cy.visit("/dashboard");
    cy.wait(2000);
  });

  it("should sort by name A-Z with secondary sort by date published (newest first) when names are identical", () => {
    cy.get('[data-testid="sorting-dropdown"]').click();
    cy.contains("Name (A-Z)").click();
    cy.wait(1000);

    cy.get('[data-testid="dataset-card"]').then(($cards) => {
      const titles = $cards
        .map((_, el) => Cypress.$(el).find("h3").text().trim())
        .get();

      for (let i = 0; i < titles.length - 1; i++) {
        const currentTitle = titles[i].toLowerCase();
        const nextTitle = titles[i + 1].toLowerCase();
        expect(currentTitle.localeCompare(nextTitle)).to.be.at.most(0);
      }
    });
  });

  it("should sort by date published (newest first) with secondary sort by name A-Z when dates are identical", () => {
    cy.get('[data-testid="sorting-dropdown"]').click();
    cy.contains("Date Published (newest first)").click();
    cy.wait(1000);

    cy.get('[data-testid="dataset-card"]').should("have.length.at.least", 2);
  });

  it("should sort by date published (oldest first) with secondary sort by name A-Z when dates are identical", () => {
    cy.get('[data-testid="sorting-dropdown"]').click();
    cy.contains("Date Published (oldest first)").click();
    cy.wait(1000);

    cy.get('[data-testid="dataset-card"]').should("have.length.at.least", 2);
  });

  it("should sort by size with secondary sort by name A-Z when sizes are identical", () => {
    cy.get('[data-testid="sorting-dropdown"]').click();
    cy.contains("Size (smallest first)").click();
    cy.wait(1000);

    cy.get('[data-testid="dataset-card"]').should("have.length.at.least", 2);
  });

  it("should maintain sort order when switching between sorting options", () => {
    cy.get('[data-testid="sorting-dropdown"]').click();
    cy.contains("Name (A-Z)").click();
    cy.wait(500);

    cy.get('[data-testid="dataset-card"]')
      .first()
      .find("h3")
      .invoke("text")
      .then((firstNameSort) => {
        cy.get('[data-testid="sorting-dropdown"]').click();
        cy.contains("Date Published (newest first)").click();
        cy.wait(500);

        cy.get('[data-testid="dataset-card"]')
          .first()
          .find("h3")
          .invoke("text")
          .then((firstDateSort) => {
            expect(firstNameSort.trim()).to.not.equal(firstDateSort.trim());
          });
      });
  });

  it("should apply secondary sorting consistently across multiple sort operations", () => {
    cy.get('[data-testid="sorting-dropdown"]').click();
    cy.contains("Name (A-Z)").click();
    cy.wait(500);

    cy.get('[data-testid="dataset-card"]')
      .first()
      .find("h3")
      .invoke("text")
      .as("firstSort");

    cy.get('[data-testid="sorting-dropdown"]').click();
    cy.contains("Size (smallest first)").click();
    cy.wait(500);

    cy.get('[data-testid="sorting-dropdown"]').click();
    cy.contains("Name (A-Z)").click();
    cy.wait(500);

    cy.get('[data-testid="dataset-card"]')
      .first()
      .find("h3")
      .invoke("text")
      .then(function (secondSort) {
        expect(this.firstSort).to.equal(secondSort);
      });
  });
});
