import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function ParcelNotFound() {
  return (
    <div className="mx-auto max-w-[640px] px-4 py-16 sm:px-6">
      <EmptyState
        icon={<MapPinOff className="h-7 w-7" aria-hidden />}
        title="This parcel isn't listed"
        body="It may have been leased, paused by the owner, or the link may be out of date. Every active parcel in the Jabalpur pilot is on the discovery map."
        action={
          <Link
            href="/discover"
            className="focus-ring mt-1 rounded-full bg-forest-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-forest-700 dark:bg-forest-500 dark:hover:bg-forest-300 dark:hover:text-forest-950"
          >
            Browse farmland →
          </Link>
        }
      />
    </div>
  );
}
