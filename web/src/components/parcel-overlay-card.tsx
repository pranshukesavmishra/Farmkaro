"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildTileFrame, bboxOf, tileUrl, type PolygonCoords, type Position } from "@/lib/geo";
import { cn } from "@/lib/cn";

export interface StatPill {
  label: string;
  value: string;
  /** Fractional position within the frame, 0–1. */
  at: { x: number; y: number };
  tone?: "default" | "accent" | "gold";
}

interface Props {
  /** Parcel outline in GeoJSON coordinates. Used to centre the satellite view
   *  and (only when confirmed) to draw a real boundary. */
  geometry: PolygonCoords;
  placeLabel?: string;
  pills?: StatPill[];
  href?: string;
  className?: string;
  /** Camera padding: higher pulls back and shows more surrounding land. */
  pad?: number;
  rounded?: string;
  children?: React.ReactNode;
  priorityLabel?: string;
  /**
   * Draw the actual boundary line ONLY when it is a real, confirmed boundary.
   * Sample parcels have no surveyed boundary, so they show a clean location pin
   * instead of a shape that would not match the land underneath.
   */
  boundaryConfirmed?: boolean;
}

/**
 * ParcelOverlayCard — a real satellite view of a parcel's location.
 *
 * The base is live satellite imagery (Esri World Imagery by default) centred on
 * the parcel. A clean location pin marks it — the recognisable property-listing
 * treatment. A dashed boundary line is drawn ONLY when `boundaryConfirmed` is
 * true, i.e. a real surveyed/walked boundary exists; we never draw an invented
 * outline over real land.
 */
export function ParcelOverlayCard({
  geometry,
  placeLabel,
  pills = [],
  href,
  className,
  pad = 2.1,
  rounded = "rounded-2xl",
  children,
  priorityLabel,
  boundaryConfirmed = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frame = useMemo(() => {
    if (!size.w || !size.h) return null;
    return buildTileFrame(bboxOf(geometry), size.w, size.h, pad);
  }, [geometry, size.w, size.h, pad]);

  const center = useMemo(() => {
    if (!frame) return null;
    const ring = geometry[0] ?? [];
    if (!ring.length) return null;
    const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return frame.project([lng, lat]);
  }, [frame, geometry]);

  const boundaryPath = useMemo(() => {
    if (!frame || !boundaryConfirmed) return null;
    const ring = geometry[0] ?? [];
    if (ring.length < 3) return null;
    return (
      ring
        .map((pt: Position, i) => {
          const { x, y } = frame.project(pt);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z"
    );
  }, [frame, geometry, boundaryConfirmed]);

  const body = (
    <div
      ref={ref}
      className={cn(
        "group relative isolate h-full w-full overflow-hidden bg-forest-950",
        rounded,
        className,
      )}
    >
      {/* Satellite base — real imagery of the actual land on any real browser. */}
      <div className="absolute inset-0" aria-hidden>
        {frame?.tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${t.z}/${t.x}/${t.y}`}
            src={tileUrl(t.x, t.y, t.z)}
            alt=""
            width={256}
            height={256}
            loading="lazy"
            decoding="async"
            className="absolute select-none"
            style={{ left: t.left, top: t.top, width: 256, height: 256 }}
          />
        ))}
      </div>

      {/* Legibility scrim, weighted to the bottom. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,20,12,.30) 0%, rgba(0,20,12,0) 34%, rgba(0,16,10,.12) 60%, rgba(0,14,9,.82) 100%)",
        }}
        aria-hidden
      />

      {/* Confirmed boundary (only when real) */}
      {boundaryPath && size.w > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          aria-hidden
        >
          <path d={boundaryPath} fill="rgba(27,107,71,0.16)" />
          <path d={boundaryPath} fill="none" stroke="rgba(0,20,12,.5)" strokeWidth={3} strokeLinejoin="round" />
          <path
            d={boundaryPath}
            fill="none"
            stroke="rgba(255,255,255,.92)"
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeDasharray="6 5"
          />
        </svg>
      )}

      {/* Location pin (default: clean, property-listing style) */}
      {center && !boundaryConfirmed && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
          style={{ left: center.x, top: center.y }}
        >
          <svg width="30" height="38" viewBox="0 0 30 38" aria-hidden className="drop-shadow-[0_3px_6px_rgba(0,0,0,.55)]">
            <path
              d="M15 0C7 0 .8 6.2.8 14c0 9.7 12.3 22.6 13 23.3.6.6 1.7.6 2.3 0 .8-.7 13-13.6 13-23.3C29.2 6.2 23 0 15 0Z"
              fill="#003622"
              stroke="#fff"
              strokeWidth="1.6"
            />
            <circle cx="15" cy="14" r="5.2" fill="#5FA37F" />
          </svg>
        </div>
      )}

      {/* Place label */}
      {center && placeLabel && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 animate-fade-up"
          style={{ left: center.x, top: center.y + 6, animationDelay: "150ms" }}
        >
          <span className="glass whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide text-white">
            {placeLabel}
          </span>
        </div>
      )}

      {/* Floating stat pills */}
      {size.w > 0 &&
        pills.map((p, i) => (
          <div
            key={p.label}
            className="pointer-events-none absolute z-10 animate-fade-up"
            style={{
              left: `${p.at.x * 100}%`,
              top: `${p.at.y * 100}%`,
              transform: "translate(-50%,-50%)",
              animationDelay: `${180 + i * 90}ms`,
            }}
          >
            <div className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5 shadow-lg">
              <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-white/62">{p.label}</span>
              <span
                className={cn(
                  "font-mono text-[12px] font-semibold tabular-nums",
                  p.tone === "gold" ? "text-gold" : p.tone === "accent" ? "text-forest-300" : "text-white",
                )}
              >
                {p.value}
              </span>
            </div>
          </div>
        ))}

      {priorityLabel && (
        <div className="pointer-events-none absolute left-3 top-3 z-10">
          <span className="glass rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white">
            {priorityLabel}
          </span>
        </div>
      )}

      {children && <div className="absolute inset-x-0 bottom-0 z-10">{children}</div>}
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="focus-ring block h-full w-full rounded-2xl">
      {body}
    </Link>
  );
}

/** Attribution required by the default free basemap. */
export function SatelliteAttribution({ className }: { className?: string }) {
  return (
    <p className={cn("text-[10.5px] muted", className)}>
      Satellite imagery: Esri World Imagery. Location shown; surveyed boundaries appear once confirmed.
    </p>
  );
}
