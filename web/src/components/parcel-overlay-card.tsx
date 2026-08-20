"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildTileFrame, bboxOf, tileUrl, type PolygonCoords, type Position } from "@/lib/geo";
import { cn } from "@/lib/cn";

export interface StatPill {
  label: string;
  value: string;
  /** Fractional position within the frame, 0–1. Kept clear of the boundary. */
  at: { x: number; y: number };
  tone?: "default" | "accent" | "gold";
}

interface Props {
  geometry: PolygonCoords;
  /** Marker label suspended under the centroid pin, as in the reference imagery. */
  placeLabel?: string;
  pills?: StatPill[];
  href?: string;
  className?: string;
  /** Larger padding pulls the camera back and shows surrounding fields. */
  pad?: number;
  rounded?: string;
  children?: React.ReactNode;
  priorityLabel?: string;
}

/**
 * ParcelOverlayCard — the platform's signature visual.
 *
 * A live satellite tile grid sits behind the parcel's ACTUAL GeoJSON boundary,
 * projected into the same Web Mercator pixel space and stroked as a thin
 * dashed white line. Never a decorative shape: if the geometry is wrong, the
 * outline is visibly wrong, which is the point.
 */
export function ParcelOverlayCard({
  geometry,
  placeLabel,
  pills = [],
  href,
  className,
  pad = 1.38,
  rounded = "rounded-2xl",
  children,
  priorityLabel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drawn, setDrawn] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!size.w) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setDrawn(true);
    const t = setTimeout(() => setDrawn(true), 980);
    return () => clearTimeout(t);
  }, [size.w]);

  const frame = useMemo(() => {
    if (!size.w || !size.h) return null;
    return buildTileFrame(bboxOf(geometry), size.w, size.h, pad);
  }, [geometry, size.w, size.h, pad]);

  const paths = useMemo(() => {
    if (!frame) return [];
    return geometry.map((ring) =>
      ring
        .map((pt: Position, i) => {
          const { x, y } = frame.project(pt);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z",
    );
  }, [frame, geometry]);

  const marker = useMemo(() => {
    if (!frame) return null;
    const ring = geometry[0] ?? [];
    if (!ring.length) return null;
    const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return frame.project([lng, lat]);
  }, [frame, geometry]);

  const body = (
    <div
      ref={ref}
      className={cn(
        "group relative isolate h-full w-full overflow-hidden bg-forest-950",
        rounded,
        className,
      )}
    >
      {/* Satellite base — real imagery of the actual land, not a stock photo. */}
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

      {/* Legibility scrim, weighted to the bottom third. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,20,12,.28) 0%, rgba(0,20,12,0) 32%, rgba(0,20,12,.16) 62%, rgba(0,16,10,.78) 100%)",
        }}
        aria-hidden
      />

      {/* Boundary overlay */}
      {frame && size.w > 0 && (
        <svg
          className="pointer-events-none absolute inset-0"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          aria-hidden
        >
          {paths.map((d, i) => (
            <g key={i}>
              <path
                d={d}
                fill="rgba(27,107,71,0.10)"
                className="transition-[fill] duration-300 group-hover:fill-[rgba(95,163,127,0.20)]"
              />
              {/* shadow pass keeps the hairline readable over bright fields */}
              <path d={d} fill="none" stroke="rgba(0,20,12,.45)" strokeWidth={3} strokeLinejoin="round" />
              <path
                d={d}
                fill="none"
                stroke="rgba(255,255,255,.92)"
                strokeWidth={1.75}
                strokeLinejoin="round"
                strokeDasharray={drawn ? "6 5" : undefined}
                className={drawn ? "" : "boundary-draw"}
                style={drawn ? undefined : ({ "--len": 4000 } as React.CSSProperties)}
              />
            </g>
          ))}

          {marker && (
            <g>
              <line
                x1={marker.x}
                y1={marker.y}
                x2={marker.x}
                y2={marker.y + 26}
                stroke="rgba(255,255,255,.7)"
                strokeWidth={1}
              />
              <circle cx={marker.x} cy={marker.y} r={5.5} fill="rgba(255,255,255,.28)" />
              <circle cx={marker.x} cy={marker.y} r={3} fill="#5FA37F" stroke="#fff" strokeWidth={1.2} />
            </g>
          )}
        </svg>
      )}

      {/* Place label suspended beneath the pin */}
      {marker && placeLabel && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 animate-fade-up"
          style={{ left: marker.x, top: marker.y + 30, animationDelay: "760ms" }}
        >
          <span className="glass rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide text-white">
            {placeLabel}
          </span>
        </div>
      )}

      {/* Floating stat pills */}
      {size.w > 0 &&
        pills.map((p, i) => (
          <div
            key={p.label}
            className="pointer-events-none absolute animate-fade-up"
            style={{
              left: `${p.at.x * 100}%`,
              top: `${p.at.y * 100}%`,
              transform: "translate(-50%,-50%)",
              animationDelay: `${900 + i * 110}ms`,
            }}
          >
            <div className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5 shadow-lg">
              <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-white/62">
                {p.label}
              </span>
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
        <div className="pointer-events-none absolute left-3 top-3">
          <span className="glass rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white">
            {priorityLabel}
          </span>
        </div>
      )}

      {children && <div className="absolute inset-x-0 bottom-0">{children}</div>}
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
      Satellite imagery: Esri World Imagery. Boundaries are owner-supplied unless marked otherwise.
    </p>
  );
}
