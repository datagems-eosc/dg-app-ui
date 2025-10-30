describe('Feature: Dataset Search Functionality', () => {


  it('Scenario: Display clear/reset button when user types text', () => {
  // Given the search field is displayed above the dataset list
  // The input uses id="search" in the rendered DOM, so select by id for robustness
  cy.get('#search').should('be.visible');

//   // And the placeholder text "Search datasets..." is visible
  cy.get('#search').should('have.attr', 'placeholder', 'Search datasets...');

//     // And the search field contains a magnifying glass icon (submit button)
    cy.get('button[aria-label="Search"]').should('be.visible');

  // When the user types "Math" into the search field
  cy.get('#search').type('Math');

    // Then an "X" clear icon should appear inside the field (aria-label="Clear search")
    cy.get('button[aria-label="Clear search"]').should('be.visible');
  });

  it('Scenario: Clear/reset button clears text and resets dataset list', () => {
    // Given the user has entered "Math" in the search field
    cy.get('#search').should('be.visible');

    // Capture the initial full results count (the "Showing:" counter)
    cy.contains('Showing:')
      .parent()
      .find('span')
      .invoke('text')
      .then((text) => {
        const initialCount = parseInt(text.trim()) || 0;

        // Enter Math and submit the search (press Enter) to show results
        cy.get('#search').type('Math{enter}');

        // Sanity: clear button should appear
        cy.get('button[aria-label="Clear search"]').should('be.visible');

        // When the user clicks on the "X" clear icon
        cy.get('button[aria-label="Clear search"]').click();

        // Then the search field should become empty
        cy.get('#search').should('have.value', '');

        // And the full list of datasets should be restored (Showing counter equals initial)
        cy.contains('Showing:')
          .parent()
          .find('span')
          .invoke('text')
          .then((afterText) => {
            const afterCount = parseInt(afterText.trim()) || 0;
            expect(afterCount).to.equal(initialCount);
          });
      });
  });

  it('Scenario: Trigger search only after pressing Enter', () => {
    // Given the user has entered "Algebra" in the search field
    cy.get('#search').should('be.visible').clear().type('Wikipedia');

    // When the user presses the "Enter" key
    cy.get('#search').type('{enter}');

    // Then the system should perform a search
    // And display datasets whose titles or descriptions contain the keyword "Wikipedia" (case-insensitive)
    // Verify at least one dataset card title contains 'Wikipedia' (case-insensitive)
    cy.contains('h2', /Wikipedia/i, { timeout: 10000 }).should('be.visible');
  });

    it('Scenario: Validate case-insensitive search', () => {
      // Given the dataset list includes "Mathe" and "MathE"
      // (This test assumes the test data contains those titles; it checks case-insensitive matching.)

      // When the user searches for "mathe" and presses Enter
      cy.get('#search').should('be.visible').clear().type('mathe{enter}');

      // Then both datasets should be displayed in the search results (case-insensitive)
      // Look through dataset card titles (h2) and count matches for /mathe/i
      cy.get('h2', { timeout: 10000 }).then(($els) => {
        const matches = Array.from($els).filter((el) => /mathe/i.test(el.innerText));
        expect(matches.length, `expected >= 2 matches for /mathe/i, found ${matches.length}`).to.be.gte(2);
      });
 });
      it('Scenario: Match keyword in title or description (case-insensitive, partial allowed)', () => {
        // Given datasets have titles and descriptions containing "EncycNet" and "Encyclopédie"


        // When the user enters "Ency" and presses Enter
        cy.get('#search').should('be.visible').clear().type('Ency{enter}');
cy.wait(1000); // wait for results to load
        // Then both datasets should appear in the results
        // We look for dataset card containers (they render with class 'rounded-2xl') and check their innerText
        cy.get('div.rounded-2xl', { timeout: 10000 }).then(($cards) => {
          const matches = Array.from($cards).filter((c) => /Ency/i.test((c as HTMLElement).innerText));
          expect(matches.length, `expected >= 2 dataset cards to contain 'Ency' (case-insensitive), found ${matches.length}`).to.be.gte(2);
        });
      });
    });

