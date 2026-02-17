import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MultiSelect } from "./MultiSelect";

const options = [
  { value: "MIT", label: "MIT License" },
  { value: "Apache-2.0", label: "Apache 2.0" },
  { value: "BSD-3", label: "BSD 3-Clause" },
];

describe("MultiSelect", () => {
  it("filters options by search term in inline variant", async () => {
    const user = userEvent.setup();
    render(
      <MultiSelect
        options={options}
        value={[]}
        onChange={() => {}}
        searchable
        variant="inline"
      />,
    );

    await user.type(screen.getByPlaceholderText("Search..."), "Apache");

    expect(screen.getByText("Apache 2.0")).toBeInTheDocument();
    expect(screen.queryByText("MIT License")).not.toBeInTheDocument();
  });

  it("shows selected values as chips and allows removal", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <MultiSelect
          options={options}
          value={value}
          onChange={setValue}
          searchable
          variant="inline"
        />
      );
    }

    render(<TestComponent />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    await user.click(screen.getByText("Apache 2.0"));
    expect(screen.getByRole("button")).toBeInTheDocument();

    await user.click(screen.getByRole("button"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
