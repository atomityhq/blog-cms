import type { Metadata } from "next";
import { AuthorsCanvas } from "@/modules/authors/AuthorsCanvas";

export const metadata: Metadata = { title: "Authors · Blog CRM" };

export default function AuthorsPage() {
  return <AuthorsCanvas />;
}
