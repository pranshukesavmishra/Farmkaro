/**
 * The FarmKaro mark — the wheat spike from the brand set, redrawn as clean
 * SVG so it ships at any size in any colour. A central grain flanked by four
 * pairs of leaf-crescents on a stem.
 */
import { cn } from "@/lib/cn";

export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 100 120"
      className={cn("fill-current", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {/* stem */}
      <rect x="47.2" y="18" width="5.6" height="102" rx="2.8" />
      {/* top grain */}
      <path d="M50 0c7 8.5 7 20.5 0 29-7-8.5-7-20.5 0-29Z" />
      {/* leaf pairs: an outer/inner arc crescent, mirrored */}
      {[0, 1, 2, 3].map((i) => {
        const y = 30 + i * 23;
        return (
          <g key={i}>
            <path
              d={`M44 ${y + 26} L26 ${y + 26} A26 26 0 0 1 44 ${y} Z
                  M44 ${y + 9} A17 17 0 0 0 33 ${y + 26} L44 ${y + 26} Z`}
              fillRule="evenodd"
            />
            <path
              d={`M56 ${y + 26} L74 ${y + 26} A26 26 0 0 0 56 ${y} Z
                  M56 ${y + 9} A17 17 0 0 1 67 ${y + 26} L56 ${y + 26} Z`}
              fillRule="evenodd"
            />
          </g>
        );
      })}
    </svg>
  );
}
