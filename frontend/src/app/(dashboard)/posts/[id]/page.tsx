import type { Metadata } from "next";
import { PostEditorCanvas } from "@/modules/posts/editor/PostEditorCanvas";

export const metadata: Metadata = { title: "Edit post · Blog CMS" };

export default async function EditPostPage(props: PageProps<"/posts/[id]">) {
  const { id } = await props.params;
  return <PostEditorCanvas postId={id} />;
}
