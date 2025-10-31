"use client";

import React from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import { Button } from "@/components/ui/Button";
import type { TableData } from "@/types/chat";

interface TemperatureMapProps {
  content: string;
  latitude?: number;
  longitude?: number;
  tableData?: TableData;
  heatColors?: string[]; // gradient from low to high
  baseRadius?: number; // controls overall heat radius (meters)
  heatOpacity?: number; // 0..1
  requireTableData?: boolean; // kept for compatibility, ignored: we now show map even without data
}

type Basemap = "map" | "satellite";

function MapLibreMap({
  latitude,
  longitude,
  heatColors,
  baseRadius,
  heatOpacity,
  showHeat,
}: {
  latitude: number;
  longitude: number;
  heatColors: string[];
  baseRadius: number;
  heatOpacity: number;
  showHeat: boolean;
}) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>("map");

  // Helpers to create an elliptical heat overlay as an image source
  const hexToRgba = React.useCallback((hex: string, alpha: number) => {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(
      normalized.length === 3
        ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
        : normalized,
      16
    );
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  const buildEllipseDataUrl = React.useCallback(
    (colors: string[], opacity: number, width = 512, height = 256): string => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      ctx.clearRect(0, 0, width, height);

      // Create an elliptical radial gradient by scaling the context on Y
      ctx.save();
      const scaleY = height / width; // 2:1 ellipse (width:height)
      const cx = width / 2;
      const cy = height / 2 / scaleY;
      ctx.scale(1, scaleY);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 2);
      const palette = colors.length
        ? colors
        : [
          "#2c7bb6",
          "#00a6ca",
          "#00ccbc",
          "#90eb9d",
          "#f9d057",
          "#f29e2e",
          "#e76818",
          "#d7191c",
        ];

      const n = palette.length;
      for (let i = 0; i < n; i++) {
        const t = (i / Math.max(1, n - 1)) * 0.95; // reserve 5% for fade-out
        grad.addColorStop(
          t,
          hexToRgba(palette[i], Math.min(1, Math.max(0, opacity)))
        );
      }
      grad.addColorStop(1, hexToRgba(palette[n - 1] ?? "#d7191c", 0));

      ctx.fillStyle = grad;
      // Draw an irregular blob with fewer points and rounded edges using Bezier smoothing
      const baseRadius = width / 2;
      const numPoints = 18; // fewer points for less angular detail
      const angleStep = (Math.PI * 2) / numPoints;
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < numPoints; i++) {
        const angle = i * angleStep;
        // Random radius variation (±10%)
        const radiusWithNoise = baseRadius * (0.9 + Math.random() * 0.2);
        points.push({
          x: cx + radiusWithNoise * Math.cos(angle),
          y: cy + radiusWithNoise * Math.sin(angle),
        });
      }

      // Catmull-Rom to Bezier conversion for smooth closed curve
      const tension = 0.5; // 0..1, higher is tighter
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < numPoints; i++) {
          const p0 = points[i];
          const p1 = points[(i + 1) % numPoints];
          const pm1 = points[(i - 1 + numPoints) % numPoints];
          const p2 = points[(i + 2) % numPoints];

          const c1x = p0.x + ((p1.x - pm1.x) * tension) / 6;
          const c1y = p0.y + ((p1.y - pm1.y) * tension) / 6;
          const c2x = p1.x - ((p2.x - p0.x) * tension) / 6;
          const c2y = p1.y - ((p2.y - p0.y) * tension) / 6;
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p1.x, p1.y);
        }
        ctx.closePath();
        ctx.fill();

        // Make the edges more transparent by eroding the border with a blurred subtractive stroke
        const fadeWidth = Math.max(2, baseRadius * 0.15);
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.lineWidth = fadeWidth;
        ctx.shadowColor = "rgba(0,0,0,1)";
        ctx.shadowBlur = fadeWidth * 0.9;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      return canvas.toDataURL("image/png");
    },
    [hexToRgba]
  );

  const metersToLatDelta = (meters: number) => meters / 111320; // approx
  const metersToLngDelta = (meters: number, atLatDeg: number) =>
    meters / (111320 * Math.cos((atLatDeg * Math.PI) / 180));

  const streetStyle: StyleSpecification = React.useMemo(
    () => ({
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "osm",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    }),
    []
  );

  const satelliteStyle: StyleSpecification = React.useMemo(
    () => ({
      version: 8,
      sources: {
        esri: {
          type: "raster",
          tiles: [
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Imagery © Esri & contributors",
        },
      },
      layers: [
        {
          id: "esri",
          type: "raster",
          source: "esri",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    }),
    []
  );

  React.useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: [longitude, latitude],
      zoom: 10,
      // Initialize with street style; basemap effect will swap if needed
      style: streetStyle,
      attributionControl: false,
      cooperativeGestures: true,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync center if props change
  React.useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter([longitude, latitude]);
  }, [latitude, longitude]);

  // Track if overlay is currently being added to prevent race conditions
  const overlayState = React.useRef({
    isAdding: false,
    cleanup: null as (() => void) | null,
  });

  // Memoize heat overlay configuration to prevent unnecessary recreations
  const heatConfig = React.useMemo(
    () => ({
      showHeat,
      imageUrl: showHeat ? buildEllipseDataUrl(heatColors, heatOpacity) : null,
      baseRadius,
      latitude,
      longitude,
    }),
    [
      showHeat,
      heatColors,
      heatOpacity,
      baseRadius,
      latitude,
      longitude,
      buildEllipseDataUrl,
    ]
  );

  // Separate effect for basemap changes (doesn't affect heat overlay directly)
  React.useEffect(() => {
    const initialMap = mapRef.current;
    if (!initialMap) return;
    const style = basemap === "map" ? streetStyle : satelliteStyle;
    initialMap.setStyle(style as any);
  }, [basemap, streetStyle, satelliteStyle]);

  // Heat overlay management (separated from basemap changes)
  React.useEffect(() => {
    const initialMap = mapRef.current;
    if (!initialMap) return;

    const sourceId = "ellipse-image";
    const layerId = "ellipse-layer";

    const removeOverlay = () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      try {
        if (currentMap.getLayer(layerId)) currentMap.removeLayer(layerId);
        if (currentMap.getSource(sourceId)) currentMap.removeSource(sourceId);
      } catch { }
    };

    const addOverlay = () => {
      // Prevent multiple simultaneous additions
      if (overlayState.current.isAdding) return;

      removeOverlay();
      if (!heatConfig.showHeat || !heatConfig.imageUrl) return;

      const currentMap = mapRef.current;
      if (!currentMap || !currentMap.isStyleLoaded()) return;

      overlayState.current.isAdding = true;

      // Compute ellipse extent in pixels so it's always visible regardless of zoom
      const computeCoordinates = (): [number, number][] => {
        const centerPoint = currentMap.project([
          heatConfig.longitude,
          heatConfig.latitude,
        ]);
        const halfWidthPx = Math.max(10, heatConfig.baseRadius * 2); // major axis = 2x
        const halfHeightPx = Math.max(5, heatConfig.baseRadius * 1); // minor axis = 1x
        const topLeft = currentMap.unproject([
          centerPoint.x - halfWidthPx,
          centerPoint.y - halfHeightPx,
        ] as any);
        const topRight = currentMap.unproject([
          centerPoint.x + halfWidthPx,
          centerPoint.y - halfHeightPx,
        ] as any);
        const bottomRight = currentMap.unproject([
          centerPoint.x + halfWidthPx,
          centerPoint.y + halfHeightPx,
        ] as any);
        const bottomLeft = currentMap.unproject([
          centerPoint.x - halfWidthPx,
          centerPoint.y + halfHeightPx,
        ] as any);
        return [
          [topLeft.lng, topLeft.lat],
          [topRight.lng, topRight.lat],
          [bottomRight.lng, bottomRight.lat],
          [bottomLeft.lng, bottomLeft.lat],
        ];
      };

      try {
        // Double-check that we don't already have these layers
        if (currentMap.getSource(sourceId) || currentMap.getLayer(layerId)) {
          overlayState.current.isAdding = false;
          return;
        }

        currentMap.addSource(sourceId, {
          type: "image",
          url: heatConfig.imageUrl,
          coordinates: computeCoordinates(),
        } as any);

        currentMap.addLayer({
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: { "raster-opacity": 1 },
        } as any);

        // Keep ellipse size consistent in pixels on interactions
        const update = () => {
          const mapNow = mapRef.current;
          if (!mapNow) return;
          const src = mapNow.getSource(sourceId) as any;
          if (src && typeof src.setCoordinates === "function") {
            src.setCoordinates(computeCoordinates());
          }
        };
        currentMap.on("move", update);
        currentMap.on("zoom", update);
        currentMap.on("rotate", update as any);
        currentMap.on("resize", update);
        update();

        overlayState.current.isAdding = false;

        return () => {
          try {
            currentMap.off("move", update);
            currentMap.off("zoom", update);
            currentMap.off("rotate", update as any);
            currentMap.off("resize", update);
          } catch { }
          try {
            if (currentMap.getLayer(layerId)) currentMap.removeLayer(layerId);
            if (currentMap.getSource(sourceId))
              currentMap.removeSource(sourceId);
          } catch { }
          overlayState.current.isAdding = false;
        };
      } catch {
        overlayState.current.isAdding = false;
      }
    };

    const setupOverlay = () => {
      // Clean up any existing overlay
      if (overlayState.current.cleanup) {
        overlayState.current.cleanup();
        overlayState.current.cleanup = null;
      }

      if (initialMap.isStyleLoaded()) {
        overlayState.current.cleanup = addOverlay() ?? null;
      } else {
        // Use a single event listener that gets cleaned up properly
        const handler = () => {
          overlayState.current.cleanup = addOverlay() ?? null;
          initialMap.off("styledata", handler);
        };
        initialMap.on("styledata", handler);

        return () => {
          initialMap.off("styledata", handler);
        };
      }
    };

    const cleanup = setupOverlay();

    return () => {
      if (cleanup) cleanup();
      if (overlayState.current.cleanup) {
        overlayState.current.cleanup();
        overlayState.current.cleanup = null;
      }
      removeOverlay();
      overlayState.current.isAdding = false;
    };
  }, [heatConfig]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Basemap toggle using shared Button styles */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <Button
          variant={basemap === "map" ? "primary" : "outline"}
          size="sm"
          onClick={() => setBasemap("map")}
        >
          Map
        </Button>
        <Button
          variant={basemap === "satellite" ? "primary" : "outline"}
          size="sm"
          onClick={() => setBasemap("satellite")}
        >
          Satellite
        </Button>
      </div>

      {/* Zoom controls (bottom-right) using Button styles */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <Button
          aria-label="Zoom in"
          variant="outline"
          size="icon"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </Button>
        <Button
          aria-label="Zoom out"
          variant="outline"
          size="icon"
          onClick={() => mapRef.current?.zoomOut()}
        >
          -
        </Button>
      </div>

      {/* Simple attribution to satisfy tile provider requirements */}
      <div className="absolute bottom-2 left-2 bg-white/80 text-[10px] text-gray-600 px-2 py-1 rounded border border-gray-200 shadow">
        {basemap === "map"
          ? "© OpenStreetMap contributors"
          : "Imagery © Esri & contributors"}
      </div>
    </div>
  );
}

export function TemperatureMap({
  content: _content,
  latitude,
  longitude,
  tableData,
  heatColors,
  baseRadius = 120,
  heatOpacity = 0.6,
}: TemperatureMapProps) {
  const hasCoordinates =
    typeof latitude === "number" && typeof longitude === "number";
  const hasTable = !!tableData;
  if (!hasCoordinates) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
      <div className="relative" style={{ height: "368px" }}>
        {typeof latitude === "number" && typeof longitude === "number" && (
          <MapLibreMap
            latitude={latitude}
            longitude={longitude}
            heatColors={heatColors ?? []}
            baseRadius={baseRadius}
            heatOpacity={heatOpacity}
            showHeat={hasTable}
          />
        )}
      </div>
    </div>
  );
}
