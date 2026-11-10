import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Search } from "./Search";

describe("Search", () => {
  it("searches once when Enter is pressed", async () => {
    const onSearch = vi.fn();
    render(<Search placeholder="Find" onSearch={onSearch} />);

    await userEvent.type(
      screen.getByPlaceholderText("Find"),
      "rainfall{Enter}",
    );

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("rainfall");
  });

  it("searches once from the search button", async () => {
    const onSearch = vi.fn();
    render(<Search placeholder="Find" value="rainfall" onSearch={onSearch} />);

    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("searches again when the same text is submitted again", async () => {
    const onSearch = vi.fn();
    render(<Search placeholder="Find" value="rainfall" onSearch={onSearch} />);

    const input = screen.getByPlaceholderText("Find");
    await userEvent.type(input, "{Enter}");
    await userEvent.type(input, "{Enter}");

    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  it("does not search under three characters", async () => {
    const onSearch = vi.fn();
    render(<Search placeholder="Find" onSearch={onSearch} />);

    await userEvent.type(screen.getByPlaceholderText("Find"), "ab{Enter}");

    expect(onSearch).not.toHaveBeenCalled();
    expect(
      screen.getByText("Search requires at least 3 characters"),
    ).toBeInTheDocument();
  });
});
