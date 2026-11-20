import { expect, it } from "vitest";
import { decodePackages } from "./adapter";
import { recommendation, snapshot } from "./fixtures/recommendation";

it("keeps the one returned package when five candidates yield one group of three", () => {
  expect(decodePackages(recommendation, snapshot)).toEqual({
    status: "ready",
    packages: [{ ...recommendation.packages[0], key: "2:0" }],
  });
});

const group = recommendation.packages[0];
const member = group.datasets[0];
it.each([
  null,
  { result: recommendation },
  { packages: null },
  { packages: [null] },
  { packages: [{ name: "bad" }] },
  { packages: [{ ...group, name: " " }] },
  ...[
    {},
    { id: "bad", name: "X" },
    { ...member, id: "00000000-0000-4000-8000-000000000099" },
    { ...member, name: "" },
  ].map((dataset) => ({ packages: [{ ...group, datasets: [dataset] }] })),
  { packages: [group, group] },
  { packages: [{ ...group, datasets: [member, member] }] },
])("rejects unusable membership or envelope %#", (input) => {
  expect(decodePackages(input, snapshot)).toEqual({
    status: "unsupported-contract",
  });
});

it("distinguishes no recommendations from a returned empty group and keeps duplicate names distinct", () => {
  expect(decodePackages({ packages: [] }, snapshot)).toEqual({
    status: "empty",
  });
  const dated = { ...member, datePublished: "2024-03-01" };
  expect(
    decodePackages(
      {
        packages: [
          { ...group, datasets: [] },
          { ...group, datasets: [dated] },
        ],
      },
      snapshot,
    ),
  ).toEqual({
    status: "ready",
    packages: [
      { key: "2:0", name: group.name, datasets: [] },
      { key: "2:1", name: group.name, datasets: [dated] },
    ],
  });
});
