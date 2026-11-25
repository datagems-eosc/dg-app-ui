import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryLocationMap } from "./QueryLocationMap";

type Handler = (event?: Record<string, unknown>) => void;

// vi.mock factories are hoisted above imports, so the mocks they use are too.
const { handlers, mockMapInstance, mockMapLibre } = vi.hoisted(() => {
  const handlers = new Map<string, Handler[]>();
  const mockMapInstance = {
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    project: vi.fn(() => ({ x: 120, y: 80 })),
    setStyle: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    addLayer: vi.fn(),
    remove: vi.fn(),
  };
  const mockMapLibre = {
    Map: vi.fn(function MockMap() {
      return mockMapInstance;
    }),
  };
  return { handlers, mockMapInstance, mockMapLibre };
});

vi.mock("maplibre-gl", () => ({ default: mockMapLibre }));

const emit = (event: string, payload?: Record<string, unknown>) =>
  act(() => {
    for (const handler of handlers.get(event) ?? []) handler(payload);
  });

const ATHENS = { latitude: 38, longitude: 23.7, source: "sql" as const };

describe("QueryLocationMap", () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    mockMapLibre.Map.mockImplementation(function MockMap() {
      return mockMapInstance;
    });
  });

  it("centres the map on the query location and labels it", async () => {
    render(<QueryLocationMap location={ATHENS} />);
    await waitFor(() => expect(mockMapLibre.Map).toHaveBeenCalled());
    expect(mockMapLibre.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [23.7, 38],
      }),
    );
    expect(screen.getByTestId("query-location-caption")).toHaveTextContent(
      "Query location 38.0, 23.7",
    );
  });

  it("draws no heat overlay", async () => {
    render(<QueryLocationMap location={ATHENS} />);
    await waitFor(() => expect(mockMapLibre.Map).toHaveBeenCalled());
    emit("load");
    expect(mockMapInstance.addLayer).not.toHaveBeenCalled();
  });

  it("keeps the map/satellite and zoom controls", async () => {
    const user = userEvent.setup();
    render(<QueryLocationMap location={ATHENS} />);
    await waitFor(() => expect(mockMapLibre.Map).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Satellite" }));
    expect(mockMapInstance.setStyle).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(mockMapInstance.zoomIn).toHaveBeenCalled();
  });

  it("falls back to text when the map errors before any tile loads", async () => {
    render(<QueryLocationMap location={ATHENS} />);
    await waitFor(() => expect(mockMapLibre.Map).toHaveBeenCalled());
    emit("error", { error: new Error("403") });
    expect(screen.getByRole("status")).toHaveTextContent(
      "The map couldn't load. Query location 38.0, 23.7",
    );
    expect(screen.queryByTestId("query-location-caption")).toBeNull();
  });

  it("keeps the map after a later tile error", async () => {
    render(<QueryLocationMap location={ATHENS} />);
    await waitFor(() => expect(mockMapLibre.Map).toHaveBeenCalled());
    emit("data", { dataType: "source", tile: {} });
    emit("error", { error: new Error("one tile") });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("falls back when the map cannot be created", async () => {
    mockMapLibre.Map.mockImplementation(() => {
      throw new Error("WebGL is not supported");
    });
    render(<QueryLocationMap location={ATHENS} />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "The map couldn't load.",
    );
  });

  it("shows zero coordinates", () => {
    render(
      <QueryLocationMap
        location={{ latitude: 0, longitude: 0, source: "sql" }}
      />,
    );
    expect(screen.getByTestId("query-location-caption")).toHaveTextContent(
      "Query location 0.0, 0.0",
    );
  });

  it("keeps the precision the query used", () => {
    render(
      <QueryLocationMap
        location={{ latitude: -33.87, longitude: 151.21, source: "sql" }}
      />,
    );
    expect(screen.getByTestId("query-location-caption")).toHaveTextContent(
      "Query location -33.87, 151.21",
    );
  });
});
