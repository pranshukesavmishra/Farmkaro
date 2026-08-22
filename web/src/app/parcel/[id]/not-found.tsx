import Link from "next/link";
import { ArrowRight, MapPinOff } from "lucide-react";

/**
 * A parcel that isn't there. Composed rather than shouted: the same survey
 * card, an honest reason, and one clear way back onto the map.
 */
export default function ParcelNotFound() {
  return (
    <div className="mx-auto flex min-h-[68vh] max-w-shell items-center justify-center px-4 py-16 sm:px-6 sm:py-24">
      <div className="card ticks grid-paper rise w-full max-w-[640px] p-8 text-center sm:p-12">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-line bg-surface-2 text-ink-faint">
          <MapPinOff className="h-6 w-6" aria-hidden />
        </div>

        <p className="eyebrow mt-6">Record not found</p>

        <h1 className="display mt-3 text-xl">This parcel isn&rsquo;t listed</h1>

        <p className="mx-auto mt-4 max-w-prose text-base leading-relaxed text-ink-muted">
          It may have been leased, paused by the owner, or the link may be out of date. Every active
          parcel in the Jabalpur pilot is on the discovery map.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/discover" className="btn btn-primary px-6 py-3">
            Browse farmland <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/" className="btn btn-quiet">
            Back to home
          </Link>
        </div>

        <p className="mx-auto mt-8 max-w-prose border-t border-line pt-6 font-mono text-xs leading-relaxed text-ink-faint">
          FarmKaro is running a pilot in Jabalpur district, Madhya Pradesh.
        </p>
      </div>
    </div>
  );
}
