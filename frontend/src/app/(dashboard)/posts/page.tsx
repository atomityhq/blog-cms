import { Suspense } from "react";
import type { Metadata } from "next";
import { PostsListCanvas } from "@/modules/posts/PostsListCanvas";

export const metadata: Metadata = { title: "Posts · Blog CMS" };

export default function PostsPage() {
  // The list reads its filters from the URL (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <PostsListCanvas />
    </Suspense>
  );
}
