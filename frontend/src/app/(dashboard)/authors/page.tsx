import type { Metadata } from "next";
import { AuthorsCanvas } from "@/modules/authors/AuthorsCanvas";

export const metadata: Metadata = { title: "Authors · Blog CMS" };

export default function AuthorsPage() {
  return <AuthorsCanvas />;
}
