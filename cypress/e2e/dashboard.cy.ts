describe("dashboard (assumes global login)", () => {
  it("shows the dashboard when the test starts authenticated", () => {
    // The global support beforeEach already performs cy.login() and clears cookies.
    // This test should therefore only assert that the app redirected to the dashboard
    // and that a dashboard-specific UI element is visible.
    cy.url({ timeout: 30000 }).should("include", "/dashboard");
    cy.contains(/Add Dataset/i, { timeout: 10000 }).should("be.visible");
  });
});
