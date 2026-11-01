import type { Metadata } from "next";
import { Suspense } from "react";

import { PostsListCanvas } from "@/modules/posts/PostsListCanvas";

export const metadata: Metadata = {
  title: "Posts · Blog CMS",
};

export default function PostsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading posts...</div>}>
      <PostsListCanvas />
    </Suspense>
  );
}
