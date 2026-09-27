import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseApi = vi.fn();
const mockUseCollections = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => mockUseCollections(),
}));

import { Classification } from "./Classification";

const data = {
  fieldsOfScience: [],
  collection: "",
  license: "",
  languages: [],
  countries: [],
};

const renderClassification = (
  props: {
    showCollection?: boolean;
    requireCountry?: boolean;
    errors?: { countries?: string };
  } = {},
) =>
  render(
    <Classification
      data={data}
      onChange={vi.fn()}
      errors={props.errors ?? {}}
      {...(props.showCollection === undefined
        ? {}
        : { showCollection: props.showCollection })}
      {...(props.requireCountry === undefined
        ? {}
        : { requireCountry: props.requireCountry })}
    />,
  );

const countryInput = () =>
  screen.getByPlaceholderText(
    "Enter country-code separate with commas e.g. US, DE, IT",
  );
const languageInput = () =>
  screen.getByPlaceholderText(
    "Enter language codes separate with commas e.g. en, de, fr",
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockUseApi.mockReturnValue({
    hasToken: true,
    getFieldsOfScience: vi.fn().mockResolvedValue([]),
    getLicenses: vi.fn().mockResolvedValue([]),
  });
  mockUseCollections.mockReturnValue({
    apiCollections: [{ id: "collection-1", name: "Weather", code: "weather" }],
    isLoadingApiCollections: false,
  });
});

describe("Classification collection visibility", () => {
  it("offers the collection selector by default, for existing consumers", async () => {
    renderClassification();

    await waitFor(() => {
      expect(screen.getByText("Collection")).toBeInTheDocument();
    });
    // `""` resolves to the explicit "No collection" option, not the placeholder.
    expect(screen.getByText("No collection")).toBeInTheDocument();
  });

  it("hides only the collection selector when a caller opts out", async () => {
    renderClassification({ showCollection: false });

    await waitFor(() => {
      expect(screen.getByText("License")).toBeInTheDocument();
    });

    expect(screen.queryByText("Collection")).not.toBeInTheDocument();
    expect(screen.queryByText("No collection")).not.toBeInTheDocument();
    // The collection name itself must not be reachable through the control.
    expect(screen.queryByText("Weather")).not.toBeInTheDocument();

    // Everything else the section owns is still there.
    expect(screen.getByText(/Field of Science/)).toBeInTheDocument();
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("Country")).toBeInTheDocument();
  });
});

describe("Classification country requiredness", () => {
  it("limits only Country when opted in and keeps Languages optional and multiple", async () => {
    function Form() {
      const [value, setValue] =
        useState<Parameters<typeof Classification>[0]["data"]>(data);
      return (
        <Classification
          data={value}
          onChange={setValue}
          errors={{}}
          requireCountry
          singleCountry
        />
      );
    }
    const user = userEvent.setup();
    render(<Form />);
    await user.type(
      screen.getByRole("textbox", { name: "Country" }),
      "US{Enter}",
    );
    expect(screen.getByRole("textbox", { name: "Country" })).toBeDisabled();
    const languages = screen.getByRole("textbox", { name: "Languages" });
    await user.type(languages, "en,pl{Enter}");
    expect(
      screen.getByRole("button", { name: "Remove en" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove pl" }),
    ).toBeInTheDocument();
    expect(languages).toBeEnabled();
    expect(languages).toHaveAttribute("aria-required", "false");
  });

  it("keeps Country and Languages optional by default, for existing consumers", async () => {
    renderClassification();

    await waitFor(() => {
      expect(screen.getByText("License")).toBeInTheDocument();
    });
    expect(screen.getByText("Country")).toHaveTextContent(/^Country$/);
    expect(countryInput()).toHaveAttribute("aria-required", "false");
    expect(languageInput()).toHaveAttribute("aria-required", "false");
  });

  it("marks only Country required when a caller opts in, and shows its error", async () => {
    renderClassification({
      requireCountry: true,
      errors: { countries: "Country is required" },
    });

    await waitFor(() => {
      expect(screen.getByText("License")).toBeInTheDocument();
    });
    expect(screen.getByText("Country")).toHaveTextContent("Country*");
    expect(countryInput()).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("Country is required")).toBeInTheDocument();
    expect(screen.getByText("Languages")).toHaveTextContent(/^Languages$/);
    expect(languageInput()).toHaveAttribute("aria-required", "false");
  });
});
