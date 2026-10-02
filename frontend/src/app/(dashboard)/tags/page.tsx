import type { Metadata } from "next";
import { TagsCanvas } from "@/modules/tags/TagsCanvas";

export const metadata: Metadata = { title: "Tags · Blog CRM" };

export default function TagsPage() {
  return <TagsCanvas />;
}
