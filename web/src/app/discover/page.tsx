import { Suspense } from "react";
import type { Metadata } from "next";
import { DiscoverClient } from "./discover-client";

export const metadata: Metadata = { title: "Discover farmland" };

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[14px]" style={{ color: "var(--fg-muted)" }}>Loading search…</div>}>
      <DiscoverClient />
    </Suspense>
  );
}
