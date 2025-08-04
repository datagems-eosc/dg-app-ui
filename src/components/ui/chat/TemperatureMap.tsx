"use client";

import React from "react";
import { Wrapper, Status } from "@googlemaps/react-wrapper";

interface TemperatureMapProps {
  content: string;
  latitude?: number;
  longitude?: number;
}

// Google Maps API key - you'll need to replace this with your actual API key
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Map component that will be rendered inside the wrapper
function MapComponent({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<google.maps.Map | null>(null);

  React.useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        // Enable all default Google Maps controls
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        scaleControl: true,
        streetViewControl: true,
        rotateControl: true,
        fullscreenControl: true,
        // Customize control positions (optional)
        zoomControlOptions: {
          position: google.maps.ControlPosition.TOP_LEFT,
        },
        fullscreenControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT,
        },
      });

      // Add a marker for the location
      new google.maps.Marker({
        position: { lat: latitude, lng: longitude },
        map: map,
        title: "Location",
      });

      mapInstanceRef.current = map;
    }
  }, [latitude, longitude]);

  return <div ref={mapRef} style={{ height: "100%", width: "100%" }} />;
}

// Loading component
function LoadingComponent() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

// Error component
function ErrorComponent() {
  return (
    <div className="flex items-center justify-center h-full text-red-600">
      <p>Error loading map</p>
    </div>
  );
}

export function TemperatureMap({
  content,
  latitude,
  longitude,
}: TemperatureMapProps) {
  // Show map only if coordinates are provided
  const hasCoordinates =
    typeof latitude === "number" && typeof longitude === "number";
  const shouldShowMap = hasCoordinates;

  if (!shouldShowMap) {
    return null;
  }

  // Render function for the wrapper
  const render = (status: Status) => {
    switch (status) {
      case Status.LOADING:
        return <LoadingComponent />;
      case Status.FAILURE:
        return <ErrorComponent />;
      case Status.SUCCESS:
        return <MapComponent latitude={latitude} longitude={longitude} />;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
      <div className="relative" style={{ height: "368px" }}>
        <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={render}>
          <MapComponent latitude={latitude} longitude={longitude} />
        </Wrapper>
      </div>
    </div>
  );
}
