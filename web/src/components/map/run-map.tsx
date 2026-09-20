"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AttributionControl,
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Crosshair, Minus, Plus } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

type LatLng = [number, number];

type RunMapProps = {
  positions: LatLng[];
  /** Live position the map looks at while there is no route yet. */
  currentPosition?: LatLng | null;
  /** Accuracy of the last reading (metres) — drawn as an uncertainty circle. */
  accuracy?: number | null;
  center?: LatLng;
  zoom?: number;
  height?: string;
  className?: string;
  followUser?: boolean;
  showMarkers?: boolean;
  interactive?: boolean;
};

/**
 * Follows the position, but defers to the user.
 *
 * The moment the user drags the map, following stops — otherwise the map
 * snaps back on every GPS reading and inspecting the route is impossible.
 * The "recenter" button brings following back.
 */
function Follower({
  position,
  enabled,
  onUserMove,
  recenterSignal,
}: {
  position: LatLng | null;
  enabled: boolean;
  onUserMove: () => void;
  recenterSignal: number;
}) {
  const map = useMap();

  // ONLY a drag releases following — it is the one unambiguous signal for
  // "I want to look elsewhere". Zooming does not break it: a user zooming
  // kendini izlemek istersin. (zoomstart programatik zoom'da da tetikleniyor,
  // in usually still wants to follow, so zoom is an unreliable signal.)
  useMapEvents({ dragstart: onUserMove });

  useEffect(() => {
    if (enabled && position) {
      map.panTo(position, { animate: true, duration: 0.5 });
    }
  }, [map, position, enabled]);

  // Return to the position when "recenter" is pressed.
  useEffect(() => {
    if (recenterSignal > 0 && position) {
      map.setView(position, Math.max(map.getZoom(), 16), { animate: true });
    }
  }, [map, recenterSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function BoundsAdjuster({ positions }: { positions: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [30, 30] });
    }
  }, [map, positions]);
  return null;
}

/** Zoom buttons — Leaflet's defaults are light-themed and small. */
function ZoomButtons() {
  const map = useMap();
  const btn =
    "flex size-9 items-center justify-center rounded-lg border border-white/10 " +
    "bg-black/70 text-white backdrop-blur transition-colors hover:bg-black/85 active:scale-95";
  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
      <button type="button" aria-label="Zoom in" className={btn} onClick={() => map.zoomIn()}>
        <Plus className="size-4" />
      </button>
      <button type="button" aria-label="Zoom out" className={btn} onClick={() => map.zoomOut()}>
        <Minus className="size-4" />
      </button>
    </div>
  );
}

export function RunMap({
  positions,
  currentPosition = null,
  accuracy = null,
  center,
  zoom = 16,
  height = "h-64",
  className,
  followUser = false,
  showMarkers = true,
  interactive = true,
}: RunMapProps) {
  const [userMoved, setUserMoved] = useState(false);
  const [recenterSignal, setRecenter] = useState(0);

  const handleUserMove = useCallback(() => {
    if (followUser) setUserMoved(true);
  }, [followUser]);

  const recenter = () => {
    setUserMoved(false);
    setRecenter((n) => n + 1);
  };

  /**
   * Centre priority: explicit request → live position → last route point → Istanbul.
   *
   * The last resort has to be a fixed coordinate: the map needs to look
   * somewhere until location permission arrives.
   */
  const live = currentPosition ?? positions[positions.length - 1] ?? null;
  const mapCenter: LatLng = center ?? live ?? [41.0082, 28.9784];
  const hasRoute = positions.length >= 2;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.06]",
        height,
        className,
      )}
    >
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        /* Zoom is ALWAYS enabled, mid-run included. A locked map stops the
           user from inspecting their own route. */
        dragging={interactive}
        scrollWheelZoom={interactive}
        touchZoom
        doubleClickZoom
      >
        <AttributionControl position="bottomright" prefix={false} />

        {/*
          Base layer is OpenStreetMap: no key, no watermark. (CARTO's dark_all
          layer now burns "API KEY REQUIRED" INTO the tile image when used
          without a key — and returns HTTP 200, so the code sees no error.)
          OSM ships light, so CSS adapts it to the dark interface.
          (bkz. globals.css .leaflet-tile-pane).
          The filter applies to the tile layer only — the route and markers
          keep their real colours.
        */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* GPS uncertainty circle — the user can see how good the signal
            is. On a poor signal, distance is not counted. */}
        {live && accuracy && accuracy > 0 && (
          <Circle
            center={live}
            radius={accuracy}
            pathOptions={{
              color: "#00c2d7",
              fillColor: "#00c2d7",
              fillOpacity: 0.08,
              weight: 1,
              opacity: 0.35,
            }}
          />
        )}

        {hasRoute && (
          <Polyline
            positions={positions}
            pathOptions={{
              color: "#fdda24",
              weight: 4,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}

        {showMarkers && positions.length > 0 && (
          <>
            <CircleMarker
              center={positions[0]}
              radius={7}
              pathOptions={{
                color: "#00c2d7",
                fillColor: "#00c2d7",
                fillOpacity: 1,
                weight: 2,
              }}
            />
            {positions.length > 1 && (
              <CircleMarker
                center={positions[positions.length - 1]}
                radius={7}
                pathOptions={{
                  color: "#fdda24",
                  fillColor: "#fdda24",
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
            )}
          </>
        )}

        {/* Show the live position even before a route exists, so the map is never blank. */}
        {showMarkers && positions.length === 0 && currentPosition && (
          <CircleMarker
            center={currentPosition}
            radius={7}
            pathOptions={{
              color: "#fdda24",
              fillColor: "#fdda24",
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}

        {followUser && (
          <Follower
            position={live}
            enabled={!userMoved}
            onUserMove={handleUserMove}
            recenterSignal={recenterSignal}
          />
        )}

        {!followUser && hasRoute && <BoundsAdjuster positions={positions} />}

        <ZoomButtons />
      </MapContainer>

      {/* A way back, once following has been released */}
      {followUser && userMoved && (
        <button
          type="button"
          onClick={recenter}
          className="absolute bottom-3 left-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-primary/30 bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-primary backdrop-blur transition-colors hover:bg-black/90"
        >
          <Crosshair className="size-3.5" />
          Merkeze al
        </button>
      )}

      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />
    </div>
  );
}
