import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { BasicInformation } from "./BasicInformation";

type BasicInformationData = {
  title: string;
  headline: string;
  description: string;
  keywords: string[];
  authors: string;
};

const initialData: BasicInformationData = {
  title: "",
  headline: "",
  description: "",
  keywords: [],
  authors: "",
};

describe("BasicInformation", () => {
  it("renders authors field with counter and max length", () => {
    render(
      <BasicInformation data={initialData} onChange={() => {}} errors={{}} />,
    );

    expect(screen.getByPlaceholderText("Enter authors")).toBeInTheDocument();
    expect(screen.getByText("0/250")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter authors")).toHaveAttribute(
      "maxLength",
      "250",
    );
  });

  it("updates authors counter as user types", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const [data, setData] = useState<BasicInformationData>(initialData);
      return <BasicInformation data={data} onChange={setData} errors={{}} />;
    }

    render(<TestComponent />);

    await user.type(screen.getByPlaceholderText("Enter authors"), "Jane Doe");

    expect(screen.getByText("8/250")).toBeInTheDocument();
  });
});
