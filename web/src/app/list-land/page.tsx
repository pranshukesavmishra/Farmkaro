import type { Metadata } from "next";
import { ListLandWizard } from "./wizard";

export const metadata: Metadata = {
  title: "List your land",
  description:
    "Add your farmland to FarmKaro: locate it, draw the exact boundary on satellite imagery, and share details. Listing is free for landowners.",
};

export default function ListLandPage() {
  return <ListLandWizard />;
}
