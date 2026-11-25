"use client";

import { Button } from "@ui/Button";
import { MapPin, MapPinOff } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { QueryLocation } from "@/lib/temperatureAnswer/queryLocation";
import { satelliteStyle, streetStyle } from "../mapStyles";

interface QueryLocationMapProps {
  location: QueryLocation;
}

type Basemap = "map" | "satellite";

/** "38.0", "-33.87": at least one decimal, never fewer than the query used. */
const coordinate = (value: number) =>
  Number.isInteger(value) ? value.toFixed(1) : String(value);

/**
 * One marker at the query location — not a station, boundary or measured
 * field. MapLibre is loaded on demand; if it cannot start, or fails before any
 * tile arrives, the location is given as text instead and nothing else in the
 * answer is affected.
 */
export function QueryLocationMap({ location }: QueryLocationMapProps) {
  const { latitude, longitude } = location;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [basemap, setBasemap] = useState<Basemap>("map");
  const coordinates = `${coordinate(latitude)}, ${coordinate(longitude)}`;

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        if (cancelled || !containerRef.current) return;
        try {
          map = new maplibregl.Map({
            container: containerRef.current,
            center: [longitude, latitude],
            zoom: 10,
            style: streetStyle,
            attributionControl: false,
            cooperativeGestures: true,
          });
        } catch {
          setFailed(true);
          return;
        }
        const instance = map;
        mapRef.current = instance;
        let tileLoaded = false;
        const placePin = () => {
          const point = instance.project([longitude, latitude]);
          setPin({ x: point.x, y: point.y });
        };
        instance.on("data", (event: { dataType?: string; tile?: unknown }) => {
          if (event.dataType === "source" && event.tile) tileLoaded = true;
        });
        // A later failing tile leaves the map usable; failing before any
        // tile means the basemap is unavailable.
        instance.on("error", () => {
          if (!tileLoaded) setFailed(true);
        });
        instance.on("load", placePin);
        instance.on("move", placePin);
        instance.on("resize", placePin);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  const chooseBasemap = (next: Basemap) => {
    setBasemap(next);
    mapRef.current?.setStyle(next === "map" ? streetStyle : satelliteStyle);
  };

  if (failed) {
    return (
      <div
        role="status"
        className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-75 px-3.5 py-3 text-body-14-regular text-gray-750"
      >
        <MapPinOff
          className="h-4.5 w-4.5 shrink-0 text-icon"
          aria-hidden="true"
        />
        <p>
          <b className="font-medium">{"The map couldn't load."}</b>{" "}
          <span className="text-gray-650">Query location {coordinates}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <section
        aria-label="Query location map"
        className="relative h-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-50"
      >
        <div ref={containerRef} className="h-full w-full" />
        <svg
          width="28"
          height="36"
          viewBox="0 0 28 36"
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
          style={
            pin ? { left: pin.x, top: pin.y } : { left: "50%", top: "50%" }
          }
        >
          <path
            d="M14 35s12-12.4 12-21A12 12 0 0 0 2 14c0 8.6 12 21 12 21z"
            className="fill-blue-500 stroke-white"
            strokeWidth="2"
          />
          <circle cx="14" cy="14" r="4.5" className="fill-white" />
        </svg>
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <Button
            variant={basemap === "map" ? "primary" : "outline"}
            size="sm"
            onClick={() => chooseBasemap("map")}
          >
            Map
          </Button>
          <Button
            variant={basemap === "satellite" ? "primary" : "outline"}
            size="sm"
            onClick={() => chooseBasemap("satellite")}
          >
            Satellite
          </Button>
        </div>
        <div className="absolute right-3 bottom-6 flex flex-col gap-2">
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
        <div className="absolute right-1.5 bottom-1 rounded bg-white/80 px-1 text-xs text-gray-600">
          {basemap === "map"
            ? "© OpenStreetMap contributors"
            : "Imagery © Esri & contributors"}
        </div>
      </section>
      <p
        data-testid="query-location-caption"
        className="flex items-center gap-1.5 text-body-14-regular text-gray-650"
      >
        <MapPin className="h-4 w-4 shrink-0 text-icon" aria-hidden="true" />
        <b className="font-semibold text-gray-750">Query location</b>{" "}
        {coordinates}
      </p>
    </div>
  );
}
