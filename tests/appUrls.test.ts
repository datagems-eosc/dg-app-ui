import assert from "node:assert/strict";
import test from "node:test";
import * as appUrls from "../src/config/appUrls";

test("APP_ROUTES contains expected static routes", () => {
  assert.equal(appUrls.APP_ROUTES.LOGIN, "/login");
  assert.equal(appUrls.APP_ROUTES.LOGOUT, "/logout");
  assert.equal(appUrls.APP_ROUTES.HOME, "/");
  assert.equal(appUrls.APP_ROUTES.DASHBOARD, "/dashboard");
  assert.equal(appUrls.APP_ROUTES.BROWSE, "/browse");
  assert.equal(appUrls.APP_ROUTES.SETTINGS, "/settings");
  assert.equal(appUrls.APP_ROUTES.CHAT, "/chat");
});

test("APP_ROUTES.CHAT_WITH_CONVERSATION returns correct url", () => {
  assert.equal(appUrls.APP_ROUTES.CHAT_WITH_CONVERSATION("abc"), "/chat/abc");
});

test("APP_ROUTES.COLLECTIONS.CUSTOM returns correct url", () => {
  assert.equal(
    appUrls.APP_ROUTES.COLLECTIONS.CUSTOM("123"),
    "/collections/custom/123",
  );
});

test("APP_ROUTES.COLLECTIONS static routes are correct", () => {
  assert.equal(
    appUrls.APP_ROUTES.COLLECTIONS.FAVORITES,
    "/collections/favorites",
  );
  assert.equal(
    appUrls.APP_ROUTES.COLLECTIONS.LANGUAGE,
    "/collections/language",
  );
  assert.equal(
    appUrls.APP_ROUTES.COLLECTIONS.LIFELONG_LEARNING,
    "/collections/lifelong-learning",
  );
  assert.equal(appUrls.APP_ROUTES.COLLECTIONS.MATH, "/collections/math");
  assert.equal(appUrls.APP_ROUTES.COLLECTIONS.WEATHER, "/collections/weather");
});

test("generateDashboardUrl returns base url if no params", () => {
  assert.equal(appUrls.generateDashboardUrl(), "/dashboard");
});

test("generateDashboardUrl with collection param", () => {
  assert.equal(
    appUrls.generateDashboardUrl({ collection: "abc" }),
    "/dashboard?collection=abc",
  );
});

test("generateDashboardUrl with isCustom param", () => {
  assert.equal(
    appUrls.generateDashboardUrl({ isCustom: true }),
    "/dashboard?isCustom=true",
  );
});

test("generateDashboardUrl with both params", () => {
  const url = appUrls.generateDashboardUrl({
    collection: "abc",
    isCustom: true,
  });
  // Order of params may vary
  assert.ok(
    url === "/dashboard?collection=abc&isCustom=true" ||
      url === "/dashboard?isCustom=true&collection=abc",
  );
});

test("generateChatUrl returns base url if no params", () => {
  assert.equal(appUrls.generateChatUrl(), "/chat");
});

test("generateChatUrl with collection param", () => {
  assert.equal(
    appUrls.generateChatUrl({ collection: "xyz" }),
    "/chat?collection=xyz",
  );
});
