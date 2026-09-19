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
  /** Henüz rota yokken haritanın bakacağı canlı konum. */
  currentPosition?: LatLng | null;
  /** Son okumanın doğruluğu (metre) — haritada belirsizlik dairesi olarak. */
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
 * Konumu takip eder ama kullanıcının iradesine saygı duyar.
 *
 * Kullanıcı haritayı elle kaydırdığı ya da yakınlaştırdığı anda takip durur —
 * yoksa her GPS okumasında harita geri zıplar ve incelemek imkânsız olur.
 * Takibe dönmek için "merkeze al" düğmesi var.
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

  // Takibi YALNIZCA sürükleme bırakır — "başka yere bakmak istiyorum"un
  // tek net işareti bu. Yakınlaştırma takibi bozmaz: zoom yaparken de
  // kendini izlemek istersin. (zoomstart programatik zoom'da da tetikleniyor,
  // o yüzden sinyal olarak güvenilmez.)
  useMapEvents({ dragstart: onUserMove });

  useEffect(() => {
    if (enabled && position) {
      map.panTo(position, { animate: true, duration: 0.5 });
    }
  }, [map, position, enabled]);

  // "Merkeze al" basıldığında konuma dön.
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

/** Zoom düğmeleri — Leaflet'in varsayılanı açık temalı ve küçük. */
function ZoomButtons() {
  const map = useMap();
  const btn =
    "flex size-9 items-center justify-center rounded-lg border border-white/10 " +
    "bg-black/70 text-white backdrop-blur transition-colors hover:bg-black/85 active:scale-95";
  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
      <button type="button" aria-label="Yakınlaştır" className={btn} onClick={() => map.zoomIn()}>
        <Plus className="size-4" />
      </button>
      <button type="button" aria-label="Uzaklaştır" className={btn} onClick={() => map.zoomOut()}>
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
   * Merkez önceliği: açık istek → canlı konum → rotanın son noktası → İstanbul.
   *
   * Son çare sabit bir koordinat olmak zorunda; konum izni gelene kadar
   * haritanın bir yere bakması gerekiyor.
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
        /* Yakınlaştırma HER ZAMAN açık — koşu sırasında da. Kilitli bir
           harita kullanıcının kendi rotasını incelemesini engeller. */
        dragging={interactive}
        scrollWheelZoom={interactive}
        touchZoom
        doubleClickZoom
      >
        <AttributionControl position="bottomright" prefix={false} />

        {/*
          Altlık OpenStreetMap: anahtarsız ve filigransız. (CARTO'nun dark_all
          altlığı anahtarsız kullanımda karo görselinin İÇİNE "API KEY REQUIRED"
          basıyor — HTTP 200 döndüğü için kod hata da görmüyor.)
          OSM açık temalı geldiği için karanlık arayüze CSS ile uyarlanıyor
          (bkz. globals.css .leaflet-tile-pane).
          Filtre yalnızca karo katmanına uygulanır — rota ve işaretçiler
          gerçek renklerinde kalır.
        */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* GPS belirsizlik dairesi — kullanıcı sinyalin ne kadar iyi
            olduğunu görüyor. Kötü sinyalde mesafe sayılmıyor. */}
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

        {/* Rota henüz yokken bile canlı konumu göster — harita boş kalmasın. */}
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

      {/* Takip bırakıldıysa geri dönüş yolu */}
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
