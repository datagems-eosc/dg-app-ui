import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import DatasetLanguageSection from "./DatasetLanguageSection";
import DatasetLicenseSection from "./DatasetLicenseSection";
import DatasetSourceUrlSection from "./DatasetSourceUrlSection";

it.each([undefined, "", "   "])(
  "hides unsupplied metadata %j instead of examples",
  (value) => {
    const { container } = render(
      <>
        <DatasetLanguageSection language={value} />
        <DatasetLicenseSection license={value} />
        <DatasetSourceUrlSection url={value} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  },
);
it("preserves supplied metadata", () => {
  render(
    <>
      <DatasetLanguageSection language="pl" />
      <DatasetLicenseSection license="CC0" />
      <DatasetSourceUrlSection url="https://data.example.org" />
    </>,
  );
  expect(screen.getByText("PL")).toBeInTheDocument();
  expect(screen.getByText("CC0")).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute(
    "href",
    "https://data.example.org",
  );
});
