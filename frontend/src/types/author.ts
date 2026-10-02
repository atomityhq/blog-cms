import type { MediaRef } from "./media";

export interface Author {
  id: string;
  name: string;
  slug: string;
  bio: string;
  avatar: MediaRef | null;
  postCount: number;
  createdAt: string;
}

/** An author as embedded in a post. */
export interface AuthorRef {
  id: string;
  name: string;
  avatar: MediaRef | null;
}

export interface AuthorInput {
  name: string;
  slug: string;
  bio: string;
  avatarId: string | null;
}
