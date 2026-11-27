import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { DatasetPlus } from "@/data/dataset";
import DatasetOverview from "./DatasetOverview";

/** Synthetic values only. */
const base: DatasetPlus = {
  id: "story",
  title: "Algebra problems",
  category: "Math",
  description:
    "About 100,000 algebraic word problems, each with multiple-choice options, the correct option and a step-by-step rationale.",
  size: "",
  lastUpdated: "",
  tags: [],
};

const aside = (
  <aside className="px-5 py-3 text-sm text-gray-650">
    Your permissions and Collections
  </aside>
);

const meta: Meta<typeof DatasetOverview> = {
  title: "DatasetDetailsPage/DatasetOverview",
  component: DatasetOverview,
  args: { aside },
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof DatasetOverview>;

export const Typical: Story = {
  args: {
    dataset: {
      ...base,
      fieldOfScience: ["Mathematics", "Computer and information sciences"],
      keywords: ["algebra", "multiple choice questions", "rationales"],
      language: "en",
      country: "GB",
      url: "https://github.com/example/algebra",
      license: "Apache-2.0",
      citation:
        "Doe, J. (2017). Algebra problems with rationales. Example Press.",
    },
  },
};

export const ManyAndLong: Story = {
  args: {
    dataset: {
      ...base,
      fieldOfScience: [
        "Mathematics",
        "Computer and information sciences",
        "Physical sciences",
        "Chemical sciences",
        "Earth and related environmental sciences",
        "Biological sciences",
        "Civil engineering",
        "Environmental engineering",
        "Basic medicine",
        "Health sciences",
      ],
      keywords: Array.from({ length: 40 }, (_, i) => `keyword number ${i + 1}`),
      language: "en,fr,de,el,pt,pl,es,it,nl,sv,fi,cs",
      country: "GR,PT,PL,DE,FR,US,GB,ES,IT,NL,SE,FI,CZ",
      url: "https://archive.example.edu/dataset/544/estimation+of+obesity+levels+based+on+eating+habits+and+physical+condition",
      license:
        "Open parliament data: free reuse with attribution (Source: the parliament), see the terms published with each release",
      citation: Array.from(
        { length: 6 },
        () => "Doe, J.; Roe, R. (2022). A long synthetic citation.",
      ).join(" "),
    },
  },
};

export const SharedSourceAndLicense: Story = {
  args: {
    dataset: {
      ...base,
      url: "https://cds.example.eu/datasets/era5-land",
      license: "https://cds.example.eu/datasets/era5-land",
    },
  },
};

export const Sparse: Story = {
  args: { dataset: { ...base, keywords: ["air quality"], license: "CC0 1.0" } },
};

export const OnlyCharacteristics: Story = {
  args: { dataset: { ...base, language: "en", country: "GR" } },
};

export const Empty: Story = {
  args: { dataset: { ...base, description: "" } },
};
