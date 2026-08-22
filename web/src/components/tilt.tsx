"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * A card that leans toward the cursor — perspective 3D with a soft glare
 * that follows the pointer. The pointer listener lives on a STABLE outer
 * element and the transform on an inner one: tilting the listener itself
 * shifts its geometry out from under the cursor, which fires pointerleave
 * and snaps the card back — an oscillation you can feel at the edges.
 * Mouse only (touch gets a plain card); reduced motion keeps it still.
 */
export function Tilt({
  children,
  className,
  max = 7,
  glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** Maximum lean, in degrees. */
  max?: number;
  glare?: boolean;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    if (inner.current) {
      inner.current.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
    }
    if (glareRef.current) {
      glareRef.current.style.background = `radial-gradient(420px circle at ${((px + 0.5) * 100).toFixed(1)}% ${((py + 0.5) * 100).toFixed(1)}%, rgba(255,255,255,0.12), transparent 62%)`;
    }
  };

  const reset = () => {
    if (inner.current) inner.current.style.transform = "perspective(900px)";
    if (glareRef.current) glareRef.current.style.background = "none";
  };

  return (
    <div className={className} onPointerMove={onMove} onPointerLeave={reset}>
      <div ref={inner} className={cn("fk-tilt rounded-[inherit]")}>
        {children}
        {glare && (
          <div aria-hidden ref={glareRef} className="pointer-events-none absolute inset-0 rounded-[inherit]" />
        )}
      </div>
    </div>
  );
}
