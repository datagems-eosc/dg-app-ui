import assert from "node:assert/strict";
import test from "node:test";
import * as utils from "../src/lib/utils";

test("cn merges class names", () => {
  assert.equal(utils.cn("a", "b"), "a b");
});

test("getBasePath returns env var or empty string", () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "/base";
  assert.equal(utils.getBasePath(), "/base");
  process.env.NEXT_PUBLIC_BASE_PATH = "";
  assert.equal(utils.getBasePath(), "");
  process.env.NEXT_PUBLIC_BASE_PATH = original;
});

test("createUrl joins base path and path", () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "/base";
  assert.equal(utils.createUrl("/foo"), "/base/foo");
  assert.equal(utils.createUrl("foo"), "/base/foo");
  process.env.NEXT_PUBLIC_BASE_PATH = "";
  assert.equal(utils.createUrl("/foo"), "/foo");
  process.env.NEXT_PUBLIC_BASE_PATH = original;
});

test("getLogoutUrl returns /logout with base path", () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "/base";
  assert.equal(utils.getLogoutUrl(), "/base/logout");
  process.env.NEXT_PUBLIC_BASE_PATH = original;
});

test("getNavigationUrl returns correct url", () => {
  const original = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = "/base";
  assert.equal(utils.getNavigationUrl("/foo"), "/base/foo");
  process.env.NEXT_PUBLIC_BASE_PATH = original;
});

test("decodeJWT decodes payload", () => {
  const payload = { name: "John", email: "john@example.com" };
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `aaa.${base64}.zzz`;
  const decoded = utils.decodeJWT(token);
  assert.deepEqual(decoded, payload);
});

test("getUserFromToken extracts user info", () => {
  const payload = {
    name: "John",
    email: "john@example.com",
    preferred_username: "johnny",
  };
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `aaa.${base64}.zzz`;
  const user = utils.getUserFromToken(token);
  assert.deepEqual(user, {
    name: "John",
    email: "john@example.com",
    preferred_username: "johnny",
  });
});

test("getApiBaseUrl returns env var or default", () => {
  const original = process.env.NEXT_PUBLIC_DATAGEMS_API_BASE_URL;
  process.env.NEXT_PUBLIC_DATAGEMS_API_BASE_URL = "https://custom.api";
  assert.equal(utils.getApiBaseUrl(), "https://custom.api");
  process.env.NEXT_PUBLIC_DATAGEMS_API_BASE_URL = "";
  assert.equal(utils.getApiBaseUrl(), "https://datagems-dev.scayle.es");
  process.env.NEXT_PUBLIC_DATAGEMS_API_BASE_URL = original;
});

test("bytesToMB and mbToBytes are inverses", () => {
  assert.equal(utils.bytesToMB(1048576), 1);
  assert.equal(utils.mbToBytes(1), 1048576);
});

test("formatFileSize formats bytes", () => {
  assert.equal(utils.formatFileSize(1023), "1023.0 B");
  assert.equal(utils.formatFileSize(1024), "1.0 KB");
  assert.equal(utils.formatFileSize(1048576), "1.0 MB");
  assert.equal(utils.formatFileSize("1048576"), "1.0 MB");
  assert.equal(utils.formatFileSize("notanumber"), "N/A");
});

test("parseSizeString parses size strings", () => {
  assert.equal(utils.parseSizeString("42.6 MB"), 42.6 * 1024 * 1024);
  assert.equal(utils.parseSizeString("1.2 GB"), 1.2 * 1024 * 1024 * 1024);
  assert.equal(utils.parseSizeString("500 KB"), 500 * 1024);
  assert.equal(utils.parseSizeString("100"), 100);
  assert.equal(utils.parseSizeString("N/A"), 0);
  assert.equal(utils.parseSizeString(""), 0);
});

test("formatRelativeTime returns correct strings", () => {
  const now = new Date();
  assert.equal(utils.formatRelativeTime(now), "Just now");
  const oneMinAgo = new Date(now.getTime() - 60 * 1000);
  assert.equal(utils.formatRelativeTime(oneMinAgo), "1 min ago");
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  assert.equal(utils.formatRelativeTime(oneHourAgo), "1 hour ago");
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  assert.equal(utils.formatRelativeTime(oneDayAgo), "1 day ago");
});

test("formatDate returns YYYY-MM-DD or -", () => {
  assert.equal(utils.formatDate("2024-01-02T12:34:56Z"), "2024-01-02");
  assert.equal(utils.formatDate(undefined), "-");
  assert.equal(utils.formatDate("notadate"), "-");
});

test("getMimeTypeName returns type or -", () => {
  assert.equal(utils.getMimeTypeName("application/json"), "json");
  assert.equal(utils.getMimeTypeName("text"), "text");
  assert.equal(utils.getMimeTypeName(undefined), "-");
});
