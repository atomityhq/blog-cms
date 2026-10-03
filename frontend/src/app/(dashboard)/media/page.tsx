import type { Metadata } from "next";
import { MediaLibraryCanvas } from "@/modules/media/MediaLibraryCanvas";

export const metadata: Metadata = { title: "Media · Blog CMS" };

export default function MediaPage() {
  return <MediaLibraryCanvas />;
}
