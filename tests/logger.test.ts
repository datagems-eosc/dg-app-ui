import assert from "node:assert/strict";
import test from "node:test";
import * as loggerModule from "../src/lib/logger";

test("apiLogger is a child logger with module:API", () => {
  assert.ok(loggerModule.apiLogger);
  assert.equal(loggerModule.apiLogger.bindings().module, "API");
});

test("logApiRequest logs info with correct structure", () => {
  let called = false;
  const origInfo = loggerModule.apiLogger.info;
  loggerModule.apiLogger.info = function (obj: any, msg?: any, ...args: any[]) {
    called = true;
    assert.equal(obj.operation, "fetch");
    assert.equal(obj.type, "request");
    assert.equal(obj.foo, "bar");
    assert.equal(msg, "API Request: fetch");
  } as any;
  loggerModule.logApiRequest("fetch", { foo: "bar" });
  loggerModule.apiLogger.info = origInfo;
  assert.ok(called);
});

test("logApiResponse logs info with correct structure", () => {
  let called = false;
  const origInfo = loggerModule.apiLogger.info;
  loggerModule.apiLogger.info = function (obj: any, msg?: any, ...args: any[]) {
    called = true;
    assert.equal(obj.operation, "fetch");
    assert.equal(obj.type, "response");
    assert.equal(obj.foo, "baz");
    assert.equal(msg, "API Response: fetch");
  } as any;
  loggerModule.logApiResponse("fetch", { foo: "baz" });
  loggerModule.apiLogger.info = origInfo;
  assert.ok(called);
});

test("logApiError logs error with correct structure", () => {
  let called = false;
  const origError = loggerModule.apiLogger.error;
  loggerModule.apiLogger.error = function (
    obj: any,
    msg?: any,
    ...args: any[]
  ) {
    called = true;
    assert.equal(obj.operation, "fetch");
    assert.equal(obj.type, "error");
    assert.equal(obj.error, "fail");
    assert.equal(obj.extra, 42);
    assert.equal(msg, "API Error: fetch");
  } as any;
  loggerModule.logApiError("fetch", { message: "fail" }, { extra: 42 });
  loggerModule.apiLogger.error = origError;
  assert.ok(called);
});
