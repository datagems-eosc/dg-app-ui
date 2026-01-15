import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableData } from "@/types/chat";
import { TemperatureMap } from "../TemperatureMap";

const mockMapInstance = {
  setCenter: vi.fn(),
  setStyle: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  project: vi.fn(() => ({ x: 0, y: 0 })),
  unproject: vi.fn(() => ({ lng: 0, lat: 0 })),
  getSource: vi.fn(),
  getLayer: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  removeSource: vi.fn(),
  removeLayer: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  isStyleLoaded: vi.fn(() => true),
  remove: vi.fn(),
};

const mockMapLibre = {
  Map: vi.fn(() => mockMapInstance),
};

vi.mock("maplibre-gl", () => ({
  default: mockMapLibre,
}));

vi.mock("@ui/Button", () => ({
  Button: ({
    children,
    onClick,
    "aria-label": ariaLabel,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-label"?: string;
    variant?: string;
  }) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      data-variant={variant}
      data-testid={ariaLabel ? `button-${ariaLabel}` : "button"}
    >
      {children}
    </button>
  ),
}));

describe("TemperatureMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when latitude is not provided", () => {
    const { container } = render(
      <TemperatureMap content="Test content" longitude={-74.006} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should not render when longitude is not provided", () => {
    const { container } = render(
      <TemperatureMap content="Test content" latitude={40.7128} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render map with controls when both coordinates are provided", () => {
    render(
      <TemperatureMap
        content="Test content"
        latitude={40.7128}
        longitude={-74.006}
      />,
    );

    expect(mockMapLibre.Map).toHaveBeenCalled();
    const calls = mockMapLibre.Map.mock.calls as unknown as Array<
      Array<{ center: [number, number]; zoom: number }>
    >;
    expect(calls.length).toBeGreaterThan(0);
    const mapCall = calls[0]?.[0];
    expect(mapCall).toBeDefined();
    if (mapCall) {
      expect(mapCall.center).toEqual([-74.006, 40.7128]);
      expect(mapCall.zoom).toBe(10);
    }

    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(screen.getByText("Satellite")).toBeInTheDocument();
    expect(screen.getByTestId("button-Zoom in")).toBeInTheDocument();
    expect(screen.getByTestId("button-Zoom out")).toBeInTheDocument();
  });

  it("should call zoomIn when zoom in button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TemperatureMap
        content="Test content"
        latitude={40.7128}
        longitude={-74.006}
      />,
    );

    const zoomInButton = screen.getByTestId("button-Zoom in");
    await user.click(zoomInButton);

    expect(mockMapInstance.zoomIn).toHaveBeenCalledTimes(1);
  });

  it("should render attribution text", () => {
    render(
      <TemperatureMap
        content="Test content"
        latitude={40.7128}
        longitude={-74.006}
      />,
    );

    expect(
      screen.getByText("© OpenStreetMap contributors"),
    ).toBeInTheDocument();
  });

  it("should accept optional props and render with defaults", () => {
    const tableData: TableData = {
      columns: [{ columnNumber: 1, name: "A" }],
      rows: [
        {
          rowNumber: 1,
          cells: [{ column: "A", value: "1" }],
        },
      ],
    };
    const heatColors = ["#0000ff", "#00ff00", "#ff0000"];

    const { rerender } = render(
      <TemperatureMap
        content="Test content"
        latitude={40.7128}
        longitude={-74.006}
      />,
    );
    expect(mockMapLibre.Map).toHaveBeenCalled();

    rerender(
      <TemperatureMap
        content="Test content"
        latitude={40.7128}
        longitude={-74.006}
        baseRadius={200}
        heatOpacity={0.8}
        heatColors={heatColors}
        tableData={tableData}
      />,
    );
    expect(mockMapLibre.Map).toHaveBeenCalled();
  });

  it("should update map center when coordinates change", () => {
    const { rerender } = render(
      <TemperatureMap
        content="Test content"
        latitude={40.7128}
        longitude={-74.006}
      />,
    );

    rerender(
      <TemperatureMap
        content="Test content"
        latitude={51.5074}
        longitude={-0.1278}
      />,
    );

    expect(mockMapInstance.setCenter).toHaveBeenCalledWith([-0.1278, 51.5074]);
  });
});
