describe("Feature: Dashboard Dataset Sorting", () => {
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

    // Wait for API request
    cy.wait("@datasetQuery").then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
    });

    // Wait for button to update
    cy.contains("button", "Size (highest first)", { timeout: 10000 }).should("be.visible");

    // Wait for cards and verify sorting with retry
    cy.get("div.rounded-2xl.border-1")
      .filter(":visible")
      .should("have.length.at.least", 1)
      .should(($cards) => {
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
          return; // Skip verification if only one dataset
        }

        const sizeInBytes = sizes.map((sizeText) => {
          const match = sizeText.match(sizeRegex);
          if (!match) return 0;
          const [, value, unit] = match;
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

        // Verify sorting - this will retry automatically if it fails
        for (let i = 0; i < sizeInBytes.length - 1; i += 1) {
          if (sizeInBytes[i] < sizeInBytes[i + 1]) {
            throw new Error(
              `Datasets not sorted correctly: position ${i} (${sizes[i]} = ${sizeInBytes[i]} bytes) is smaller than position ${i + 1} (${sizes[i + 1]} = ${sizeInBytes[i + 1]} bytes)`
            );
          }
        }
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
});


