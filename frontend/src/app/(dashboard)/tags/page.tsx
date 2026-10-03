import type { Metadata } from "next";
import { TagsCanvas } from "@/modules/tags/TagsCanvas";

export const metadata: Metadata = { title: "Tags · Blog CMS" };

export default function TagsPage() {
  return <TagsCanvas />;
}
