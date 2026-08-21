"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { formatINR, type Position } from "@/lib/geo";
import { loadGoogleMaps } from "@/lib/google-maps";
import type { ParcelView } from "@/lib/types";
import { Loader2 } from "lucide-react";

/**
 * Google Maps rendering of the discovery map — real Google satellite imagery,
 * price-pill markers for every farm (pins), and the selected farm's real
 * boundary drawn as a polygon (pin + polygon combined). Same props as the
 * MapLibre ParcelMap so the two are interchangeable behind DiscoveryMap.
 */

interface Props {
  parcels: ParcelView[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  center?: Position;
  radiusKm?: number;
  className?: string;
}

const compactRent = (n: number) => formatINR(n, { compact: true });

/** Custom price-pill overlay so markers look like a real property site. */
function makePriceOverlay(google: any) {
  return class PriceOverlay extends google.maps.OverlayView {
    div: HTMLElement | null = null;
    constructor(
      public position: any,
      public label: string,
      public onClick: () => void,
    ) {
      super();
    }
    onAdd() {
      const div = document.createElement("button");
      div.type = "button";
      div.className = "fk-gm-marker";
      div.innerHTML = `<span class="fk-gm-pill">${this.label}</span><span class="fk-gm-tip"></span>`;
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onClick();
      });
      this.div = div;
      this.getPanes().floatPane.appendChild(div);
    }
    draw() {
      if (!this.div) return;
      const p = this.getProjection().fromLatLngToDivPixel(this.position);
      this.div.style.left = `${p.x}px`;
      this.div.style.top = `${p.y}px`;
    }
    setSelected(sel: boolean) {
      this.div?.classList.toggle("is-selected", sel);
    }
    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  };
}

export function GoogleParcelMap({ parcels, selectedId, onSelect, center, radiusKm, className }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const overlays = useRef<Map<string, any>>(null!);
  if (!overlays.current) overlays.current = new Map();
  const selectedPoly = useRef<any>(null);
  const radiusCircle = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !holder.current) return;
        googleRef.current = google;
        map.current = new google.maps.Map(holder.current, {
          center: { lng: center?.[0] ?? 79.9864, lat: center?.[1] ?? 23.1815 },
          zoom: 11,
          mapTypeId: "hybrid", // satellite + road/label overlay
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
        });
        map.current.addListener("click", () => onSelect?.(null));
        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers.
  useEffect(() => {
    const google = googleRef.current;
    if (!google || !map.current || !ready) return;
    const PriceOverlay = makePriceOverlay(google);

    const wanted = new Set(parcels.map((p) => p.id));
    for (const [id, ov] of overlays.current) {
      if (!wanted.has(id)) {
        ov.setMap(null);
        overlays.current.delete(id);
      }
    }
    for (const p of parcels) {
      if (overlays.current.has(p.id)) continue;
      const ov = new PriceOverlay(
        new google.maps.LatLng(p.centroid[1], p.centroid[0]),
        compactRent(p.listing.rentAnnual),
        () => onSelect?.(p.id),
      );
      ov.setMap(map.current);
      overlays.current.set(p.id, ov);
    }

    if (parcels.length) {
      const bounds = new google.maps.LatLngBounds();
      for (const p of parcels) bounds.extend({ lng: p.centroid[0], lat: p.centroid[1] });
      map.current.fitBounds(bounds, 70);
    }
  }, [parcels, ready, onSelect]);

  // Radius circle.
  useEffect(() => {
    const google = googleRef.current;
    if (!google || !map.current || !ready) return;
    radiusCircle.current?.setMap(null);
    if (center && radiusKm) {
      radiusCircle.current = new google.maps.Circle({
        map: map.current,
        center: { lng: center[0], lat: center[1] },
        radius: radiusKm * 1000,
        strokeColor: "#5FA37F",
        strokeOpacity: 0.8,
        strokeWeight: 1.2,
        fillColor: "#5FA37F",
        fillOpacity: 0.06,
      });
    }
  }, [center, radiusKm, ready]);

  // Selected: highlight pill + draw the real boundary polygon + recentre.
  useEffect(() => {
    const google = googleRef.current;
    if (!google || !map.current || !ready) return;
    for (const [id, ov] of overlays.current) ov.setSelected?.(id === selectedId);
    selectedPoly.current?.setMap(null);
    const target = selectedId ? parcels.find((p) => p.id === selectedId) : null;
    if (target) {
      const path = target.geometry[0].map((c) => ({ lng: c[0], lat: c[1] }));
      selectedPoly.current = new google.maps.Polygon({
        map: map.current,
        paths: path,
        strokeColor: "#F2D89A",
        strokeOpacity: 0.95,
        strokeWeight: 2,
        fillColor: "#C9A24B",
        fillOpacity: 0.18,
      });
      map.current.panTo({ lng: target.centroid[0], lat: target.centroid[1] });
      if (map.current.getZoom() < 15) map.current.setZoom(15);
    }
  }, [selectedId, ready, parcels]);

  if (error) {
    return (
      <div className={className}>
        <div className="grid h-full w-full place-items-center bg-forest-950 p-6 text-center">
          <p className="max-w-xs text-[13px] text-forest-100">
            Google Maps could not load. Check the API key and its allowed referrers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <style>{GM_CSS}</style>
      <div ref={holder} className="h-full w-full" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-forest-950/70">
          <span className="flex items-center gap-2 text-[13px] text-forest-100">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Google satellite…
          </span>
        </div>
      )}
    </div>
  );
}

const GM_CSS = `
.fk-gm-marker { position: absolute; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer; background: none; border: 0; padding: 0; }
.fk-gm-pill { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; font-weight: 600; line-height: 1; color: #fff; background: #003622; border: 1.5px solid rgba(255,255,255,.9); padding: 5px 9px; border-radius: 999px; box-shadow: 0 2px 8px rgba(0,0,0,.45); white-space: nowrap; }
.fk-gm-marker.is-selected .fk-gm-pill { background: #C9A24B; color: #1a1405; }
.fk-gm-marker:hover .fk-gm-pill { background: #0B4A32; }
.fk-gm-tip { width: 2px; height: 8px; background: rgba(255,255,255,.85); }
.fk-gm-marker.is-selected .fk-gm-tip { background: #C9A24B; }
`;
