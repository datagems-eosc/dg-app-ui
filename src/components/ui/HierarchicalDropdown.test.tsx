import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import HierarchicalDropdown, {
  type HierarchicalCategory,
} from "./HierarchicalDropdown";

const CATEGORY_SOURCE = [
  {
    name: "Natural sciences",
    code: "1",
    options: [
      { value: "1.01", label: "Mathematics", code: "1.01" },
      { value: "1.02", label: "Computer sciences", code: "1.02" },
    ],
  },
  {
    name: "Engineering and technology",
    code: "2",
    options: [
      { value: "2.01", label: "Civil engineering", code: "2.01" },
      { value: "2.02", label: "Electrical engineering", code: "2.02" },
    ],
  },
  {
    name: "Medical and health sciences",
    code: "3",
    options: [{ value: "3.01", label: "Basic medicine", code: "3.01" }],
  },
];

const READ_LIMIT = 300;
const RENDER_LOOP_MESSAGE = `HierarchicalDropdown render loop: the categories prop was read more than ${READ_LIMIT} times`;

/**
 * ON-BUG-01 tripwire. The categories prop is handed to the component behind a
 * proxy that counts how often it is read and throws once the count is
 * implausible for a finite number of renders.
 *
 * It is needed because a render loop in this component does not fail a test, it
 * hangs the whole run: the repeated updates come from a passive effect and are
 * scheduled rather than nested, so they never reach React's own update-depth
 * guard and never surface as an error the test runner can attribute.
 */
function guarded(categories: HierarchicalCategory[]): HierarchicalCategory[] {
  let reads = 0;
  return new Proxy(categories, {
    get(target, property, receiver) {
      reads += 1;
      if (reads > READ_LIMIT) {
        throw new Error(RENDER_LOOP_MESSAGE);
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function createCategories(): HierarchicalCategory[] {
  return guarded(CATEGORY_SOURCE.map((category) => ({ ...category })));
}

function ControlledDropdown({
  categories,
  initialValue = [],
  onValueChange,
}: {
  categories: HierarchicalCategory[];
  initialValue?: string[];
  onValueChange?: (value: string[]) => void;
}) {
  const [value, setValue] = useState<string[]>(initialValue);

  return (
    <HierarchicalDropdown
      value={value}
      onChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
      categories={categories}
      searchPlaceholder="Search..."
      noOptionsText="No fields of science found"
    />
  );
}

const searchBox = () => screen.getByPlaceholderText("Search...");

describe("HierarchicalDropdown", () => {
  describe("search", () => {
    it("filters options down to the matching categories", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      await user.type(searchBox(), "engineering");

      expect(screen.getByLabelText("Civil engineering")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Electrical engineering"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Mathematics")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Medical and health sciences"),
      ).not.toBeInTheDocument();
    });

    it("matches on the option code as well as the label", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      await user.type(searchBox(), "3.01");

      expect(screen.getByLabelText("Basic medicine")).toBeInTheDocument();
      expect(screen.queryByLabelText("Mathematics")).not.toBeInTheDocument();
    });

    it("narrows the results as the query is extended", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      await user.type(searchBox(), "e");
      expect(screen.getByLabelText("Computer sciences")).toBeInTheDocument();
      expect(screen.getByLabelText("Basic medicine")).toBeInTheDocument();

      await user.type(searchBox(), "lectrical");
      expect(
        screen.getByLabelText("Electrical engineering"),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText("Computer sciences"),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Basic medicine")).not.toBeInTheDocument();
    });

    it("shows the empty state when nothing matches and recovers when cleared", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      await user.type(searchBox(), "astrophysics");

      expect(
        screen.getByText("No fields of science found"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Mathematics")).not.toBeInTheDocument();

      await user.clear(searchBox());

      expect(
        screen.queryByText("No fields of science found"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Natural sciences")).toBeInTheDocument();
      expect(
        screen.getByText("Engineering and technology"),
      ).toBeInTheDocument();
    });

    it("restores every category and collapses them again when the query is cleared", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      await user.type(searchBox(), "mathematics");
      expect(screen.getByLabelText("Mathematics")).toBeInTheDocument();

      await user.clear(searchBox());

      expect(screen.getByText("Natural sciences")).toBeInTheDocument();
      expect(
        screen.getByText("Medical and health sciences"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Mathematics")).not.toBeInTheDocument();
    });
  });

  describe("category expansion", () => {
    it("starts collapsed and expands a category on click", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      expect(screen.queryByLabelText("Mathematics")).not.toBeInTheDocument();

      await user.click(screen.getByText("Natural sciences"));

      expect(screen.getByLabelText("Mathematics")).toBeInTheDocument();
      expect(screen.getByLabelText("Computer sciences")).toBeInTheDocument();
    });

    it("collapses an expanded category on a second click", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      await user.click(screen.getByText("Natural sciences"));
      await user.click(screen.getByText("Natural sciences"));

      expect(screen.queryByLabelText("Mathematics")).not.toBeInTheDocument();
    });

    it("auto-expands the categories that contain search results", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      await user.type(searchBox(), "engineering");

      expect(screen.getByLabelText("Civil engineering")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Electrical engineering"),
      ).toBeInTheDocument();
    });

    it("keeps a manual collapse while the query stays the same", async () => {
      const user = userEvent.setup();
      render(<ControlledDropdown categories={createCategories()} />);

      await user.type(searchBox(), "engineering");
      expect(screen.getByLabelText("Civil engineering")).toBeInTheDocument();

      await user.click(screen.getByText("Engineering and technology"));

      expect(
        screen.queryByLabelText("Civil engineering"),
      ).not.toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("selects an option and reports the new value", async () => {
      const user = userEvent.setup();
      const changes: string[][] = [];
      render(
        <ControlledDropdown
          categories={createCategories()}
          onValueChange={(value) => changes.push(value)}
        />,
      );

      await user.type(searchBox(), "mathematics");
      await user.click(screen.getByLabelText("Mathematics"));

      expect(changes).toEqual([["1.01"]]);
      expect(screen.getByLabelText("Mathematics")).toBeChecked();
    });

    it("deselects an already selected option", async () => {
      const user = userEvent.setup();
      const changes: string[][] = [];
      render(
        <ControlledDropdown
          categories={createCategories()}
          initialValue={["1.01"]}
          onValueChange={(value) => changes.push(value)}
        />,
      );

      await user.type(searchBox(), "mathematics");
      expect(screen.getByLabelText("Mathematics")).toBeChecked();

      await user.click(screen.getByLabelText("Mathematics"));

      expect(changes).toEqual([[]]);
      expect(screen.getByLabelText("Mathematics")).not.toBeChecked();
    });

    it("keeps the selection while the query changes and after it is cleared", async () => {
      const user = userEvent.setup();
      render(
        <ControlledDropdown
          categories={createCategories()}
          initialValue={["1.01"]}
        />,
      );

      await user.type(searchBox(), "mathematics");
      expect(screen.getByLabelText("Mathematics")).toBeChecked();

      await user.clear(searchBox());
      await user.type(searchBox(), "math");
      expect(screen.getByLabelText("Mathematics")).toBeChecked();

      await user.clear(searchBox());
      await user.click(screen.getByText("Natural sciences"));
      expect(screen.getByLabelText("Mathematics")).toBeChecked();
      expect(screen.getByLabelText("Computer sciences")).not.toBeChecked();
    });

    it("counts the selected options of a category that the search filtered out", async () => {
      const user = userEvent.setup();
      render(
        <ControlledDropdown
          categories={createCategories()}
          initialValue={["1.01", "1.02"]}
        />,
      );

      expect(screen.getByText("2")).toBeInTheDocument();

      await user.type(searchBox(), "mathematics");

      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  describe("parent updates", () => {
    it("survives a parent re-render that passes an equal but new categories array", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <HierarchicalDropdown
          value={["1.01"]}
          onChange={() => {}}
          categories={createCategories()}
          searchPlaceholder="Search..."
          noOptionsText="No fields of science found"
        />,
      );

      await user.type(searchBox(), "mathematics");

      rerender(
        <HierarchicalDropdown
          value={["1.01"]}
          onChange={() => {}}
          categories={createCategories()}
          searchPlaceholder="Search..."
          noOptionsText="No fields of science found"
        />,
      );

      expect(screen.getByLabelText("Mathematics")).toBeChecked();
    });

    it("applies categories that arrive after the first render", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <HierarchicalDropdown
          value={[]}
          onChange={() => {}}
          categories={guarded([])}
          searchPlaceholder="Search..."
          noOptionsText="No fields of science found"
        />,
      );

      await user.type(searchBox(), "mathematics");
      expect(
        screen.getByText("No fields of science found"),
      ).toBeInTheDocument();

      rerender(
        <HierarchicalDropdown
          value={[]}
          onChange={() => {}}
          categories={createCategories()}
          searchPlaceholder="Search..."
          noOptionsText="No fields of science found"
        />,
      );

      expect(screen.getByLabelText("Mathematics")).toBeInTheDocument();
    });

    // No tripwire is possible here: a non-array prop is replaced by an internal
    // empty array, so the test has nothing it can count. If the ON-BUG-01 loop
    // is reintroduced this case hangs instead of failing; the guarded cases
    // above fail first and name the cause.
    it("tolerates a categories prop that is not an array", () => {
      render(
        <HierarchicalDropdown
          value={[]}
          onChange={() => {}}
          categories={undefined as unknown as HierarchicalCategory[]}
          searchPlaceholder="Search..."
          noOptionsText="No fields of science found"
        />,
      );

      expect(
        screen.getByText("No fields of science found"),
      ).toBeInTheDocument();
    });
  });
});
