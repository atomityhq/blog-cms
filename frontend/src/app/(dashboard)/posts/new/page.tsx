import type { Metadata } from "next";
import { PostEditorCanvas } from "@/modules/posts/editor/PostEditorCanvas";

export const metadata: Metadata = { title: "New post · Blog CMS" };

export default function NewPostPage() {
  return <PostEditorCanvas />;
}
