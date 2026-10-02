import type { Metadata } from "next";
import { PostsListCanvas } from "@/modules/posts/PostsListCanvas";

export const metadata: Metadata = { title: "Posts · Blog CRM" };

export default function PostsPage() {
  return <PostsListCanvas />;
}
