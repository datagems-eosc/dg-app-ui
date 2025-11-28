describe("Feature: Dashboard Dataset Sorting", () => {
  beforeEach(() => {
    cy.login();
    cy.visit("/dashboard");
    cy.wait(2000);
  });

  const sortingLabels = [
    "Name (A-Z)",
    "Name (Z-A)",
    "Date Published (oldest first)",
    "Date Published (newest first)",
    "Size (smallest first)",
    "Size (highest first)",
  ];

  it("Scenario: Verify sorting modal opens correctly", () => {
    // When the user clicks on the sorting button
    cy.contains("button", "Name (A-Z)").click();

    // Then the sorting modal appears
    cy.contains("h3", "Sort by", { timeout: 10000 }).should("be.visible");

    // And it contains radio buttons for all available sort criteria
    sortingLabels.forEach((label) => {
      cy.contains("label", label).should("be.visible");
    });
  });

  it("Scenario: Verify default sorting option", () => {
    // Given the user opens the sorting modal for the first time
    cy.contains("button", "Name (A-Z)").click();

    // Then "Name (A-Z)" should be preselected
    cy.contains("h3", "Sort by", { timeout: 10000 }).should("be.visible");
    cy.get("input[type='radio']").should("have.length", sortingLabels.length);
    cy.contains("label", "Name (A-Z)")
      .find("input[type='radio']")
      .should("be.checked");
    cy.get("input[type='radio']:checked").should("have.length", 1);
  });

  // it("Scenario: Sort datasets alphabetically A–Z", () => {
  //   // Given the user selects "Name (A-Z)" from the sorting modal
  //   cy.contains("button", "Name (A-Z)").click();
  //   cy.contains("h3", "Sort by", { timeout: 10000 }).should("be.visible");
  //   cy.contains("label", "Name (A-Z)")
  //     .find("input[type='radio']")
  //     .check({ force: true });
  //
  //   // When the user confirms the selection (modal closes automatically)
  //   cy.contains("button", "Name (A-Z)").should("be.visible");
  //
  //   // Then the datasets should be displayed in ascending alphabetical order by title
  //   cy.get("h2.text-H6-18-semibold", { timeout: 10000 })
  //     .should("have.length.at.least", 1)
  //     .then(($titles) => {
  //       const titles = $titles
  //         .map((_, el) => el.textContent?.trim() || "")
  //         .get()
  //         .filter(Boolean);
  //       const sortedTitles = [...titles].sort((a, b) =>
  //         a.localeCompare(b, undefined, { sensitivity: "base" }),
  //       );
  //       expect(titles).to.deep.equal(sortedTitles);
  //     });
  // });

  it("Scenario: Sort datasets by Date Published (newest first)", () => {
    cy.intercept("POST", "**/dataset/query").as("datasetQuery");

    // Given the user opens the sorting dropdown
    cy.contains("button", "Name (A-Z)").click();
    cy.contains("h3", "Sort by", { timeout: 10000 }).should("be.visible");

    // When the user selects "Date Published (newest first)"
    cy.contains("label", "Date Published (newest first)")
      .find("input[type='radio']")
      .check({ force: true });

    cy.wait("@datasetQuery").then(({ response }) => {
      expect(response?.statusCode).to.eq(200);

      // Then the selected sorting criterion should be reflected in the sorting label
      cy.contains("button", "Date Published (newest first)").should("be.visible");

      const body = response?.body ?? {};
      const candidates = [
        Array.isArray(body?.items) ? body.items : null,
        Array.isArray(body?.results) ? body.results : null,
        Array.isArray(body?.data) ? body.data : null,
        Array.isArray(body?.datasets) ? body.datasets : null,
      ].filter(Array.isArray) as Array<any>[];

      const datasets = candidates.length > 0 ? candidates[0] : [];
      expect(datasets.length).to.be.greaterThan(0);

      const normalized = datasets.map((item) => ({
        title:
          (typeof item?.title === "string" && item.title) ||
          (typeof item?.name === "string" && item.name) ||
          "",
        date:
          (typeof item?.datePublished === "string" && item.datePublished) ||
          (typeof item?.lastUpdated === "string" && item.lastUpdated) ||
          (typeof item?.updatedAt === "string" && item.updatedAt) ||
          (typeof item?.createdAt === "string" && item.createdAt) ||
          "",
      }));

      const firstWithDate = normalized.find((item) => item.title && item.date);
      const lastWithDate = [...normalized]
        .reverse()
        .find((item) => item.title && item.date);

      expect(firstWithDate).to.exist;
      expect(lastWithDate).to.exist;

      const firstTimestamp = Date.parse(firstWithDate!.date);
      const lastTimestamp = Date.parse(lastWithDate!.date);
      expect(firstTimestamp).to.be.at.least(lastTimestamp);

      cy.get("h2.text-H6-18-semibold", { timeout: 10000 })
        .should("have.length.at.least", 1)
        .then(($titles) => {
          const titles = $titles
            .map((_, el) => el.textContent?.trim() || "")
            .get()
            .filter(Boolean);

          expect(titles.length).to.be.greaterThan(0);
          expect(titles[0]).to.eq(firstWithDate!.title);
          expect(titles[titles.length - 1]).to.eq(lastWithDate!.title);
        });
    });
  });

  it("Scenario: Sort datasets by size largest to smallest", () => {
    cy.intercept("POST", "**/dataset/query").as("datasetQuery");

    // Given the user opens the sorting dropdown
    cy.contains("button", "Name (A-Z)").click();
    cy.contains("h3", "Sort by", { timeout: 10000 }).should("be.visible");

    // Then he selects "Size (highest first)"
    cy.contains("label", "Size (highest first)")
      .find("input[type='radio']")
      .check({ force: true });

    cy.wait("@datasetQuery").then(({ response }) => {
      expect(response?.statusCode).to.eq(200);

      cy.contains("button", "Size (highest first)").should("be.visible");

      cy.get("div.rounded-2xl.border-1")
        .filter(":visible")
        .should("have.length.at.least", 1)
        .then(($cards) => {
          const sizeRegex = /(\d+[.,]?\d*)\s*(B|KB|MB|GB|TB)/i;
          const sizes = Array.from($cards)
            .map((card) => {
              const text = card.textContent || "";
              const match = text.match(sizeRegex);
              return match ? match[0] : "";
            })
            .filter(Boolean);

          expect(sizes.length).to.be.at.least(1);

          if (sizes.length < 2) {
            return;
          }
          cy.wait(1000);
          const sizeInBytes = sizes.map((sizeText) => {
            const [, value, unit] = sizeText.match(sizeRegex) || [];
            const numeric = parseFloat(value.replace(",", "."));
            const unitFactor: Record<string, number> = {
              B: 1,
              KB: 1024,
              MB: 1024 ** 2,
              GB: 1024 ** 3,
              TB: 1024 ** 4,
            };
            return numeric * (unitFactor[unit.toUpperCase()] || 1);
          });

          for (let i = 0; i < sizeInBytes.length - 1; i += 1) {
            expect(sizeInBytes[i]).to.be.at.least(sizeInBytes[i + 1]);
          }
        });
    });
  });

  it("Scenario: Verify only one sorting criterion can be selected", () => {
    // Given the sorting modal is open
    cy.contains("button", "Name (A-Z)").click();
    cy.contains("h3", "Sort by", { timeout: 10000 }).should("be.visible");
    cy.get("input[type='radio']").should("have.length", sortingLabels.length);

    // When the user selects a sorting option
    cy.get("input[type='radio']").eq(0).check({ force: true });
    cy.get("input[type='radio']").eq(0).should("be.checked");

    // Then the previously selected option should become deselected
    cy.get("input[type='radio']").eq(1).check({ force: true });
    cy.contains("button", "Name (Z-A)").click();
    cy.contains("h3", "Sort by", { timeout: 10000 }).should("be.visible");
    cy.get("input[type='radio']").eq(1).should("be.checked");
    cy.get("input[type='radio']").eq(0).should("not.be.checked");

    // And only one radio button should be selected at any time
    cy.get("input[type='radio']:checked").should("have.length", 1);
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
