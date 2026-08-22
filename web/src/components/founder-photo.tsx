"use client";

import { useEffect, useRef } from "react";

/**
 * A founder's portrait that steps aside gracefully: until the photo file
 * exists in /public/founders, the monogram behind it shows — no broken-image
 * glyph, no floating alt text. The 404 usually fires BEFORE React hydrates,
 * so onError alone misses it; the mount effect re-checks the settled state.
 */
export function FounderPhoto({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) el.style.display = "none";
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover object-top"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
