import { expect, it, vi } from "vitest";
import { ids, recommendation, snapshot } from "./fixtures/recommendation";
import { recommendPackages } from "./gateway";

it("posts a deduplicated explicit pool once without replay and decodes the direct response", async () => {
  const transport = vi.fn().mockResolvedValue(Response.json(recommendation));
  const result = await recommendPackages(
    { ...snapshot, candidateIds: [...ids, ids[0]] },
    transport,
  );
  expect(result.status).toBe("ready");
  expect(transport).toHaveBeenCalledTimes(1);
  const [path, init, policy] = transport.mock.calls[0];
  expect([path, init.method, policy]).toEqual([
    "/search/package/recommend",
    "POST",
    { retryOn401: false },
  ]);
  expect(JSON.parse(init.body)).toEqual({
    datasetIds: ids,
    packagesCount: 2,
    datasetsPerPackage: 3,
    project: { fields: ["id", "name", "datePublished"] },
  });
});

it.each([
  [{ candidateIds: [] }, "insufficient-candidates"],
  [{ candidateIds: [ids[0], ids[0], ids[1]] }, "insufficient-candidates"],
  [{ candidateIds: ["bad", ...ids] }, "invalid-request"],
  [{ packagesCount: 0 }, "invalid-request"],
  [{ packagesCount: 2.5 }, "invalid-request"],
  [{ datasetsPerPackage: 1 }, "invalid-request"],
  [{ datasetsPerPackage: 6 }, "insufficient-candidates"],
] as const)("avoids invalid requests %#", async (changes, status) => {
  const transport = vi.fn();
  expect(
    await recommendPackages({ ...snapshot, ...changes }, transport),
  ).toEqual({ status });
  expect(transport).not.toHaveBeenCalled();
});

it.each([
  [400, "invalid-request"],
  [401, "unauthenticated"],
  [403, "forbidden"],
  [503, "error"],
] as const)(
  "classifies HTTP %i without a retry",
  async (httpStatus, status) => {
    const transport = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: httpStatus }));
    expect(await recommendPackages(snapshot, transport)).toEqual({
      status,
      httpStatus,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  },
);

it("distinguishes a network failure from unreadable response JSON", async () => {
  expect(
    await recommendPackages(
      snapshot,
      vi.fn().mockRejectedValue(new Error("offline")),
    ),
  ).toEqual({ status: "error" });
  expect(
    await recommendPackages(
      snapshot,
      vi.fn().mockResolvedValue(new Response("bad")),
    ),
  ).toEqual({ status: "unsupported-contract" });
});

it("skips transport when a disabled or unconfigured caller supplies no snapshot", async () => {
  const transport = vi.fn();
  expect(await recommendPackages(null, transport)).toEqual({
    status: "unavailable",
  });
  expect(transport).not.toHaveBeenCalled();
});

it("rejects package counts beyond the Gateway integer representation", async () => {
  const transport = vi.fn();
  expect(
    await recommendPackages({ ...snapshot, packagesCount: 2 ** 31 }, transport),
  ).toEqual({ status: "invalid-request" });
  expect(transport).not.toHaveBeenCalled();
});

it("decodes against the submitted pool and generation while the caller changes context", async () => {
  const pending = { ...snapshot, candidateIds: [...ids] };
  const result = await recommendPackages(pending, async () => {
    pending.generation++;
    pending.candidateIds.splice(0);
    return Response.json(recommendation);
  });
  expect(result).toMatchObject({ status: "ready", packages: [{ key: "2:0" }] });
});
