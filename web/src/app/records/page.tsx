import type { Metadata } from "next";
import { RecordsClient } from "./records-client";

export const metadata: Metadata = {
  title: "Find my land — भू-अभिलेख खोज",
  description:
    "Look up your own land record by khasra number or Land ID and see it on the map — Jabalpur pilot.",
};

export default function RecordsPage() {
  return <RecordsClient />;
}
