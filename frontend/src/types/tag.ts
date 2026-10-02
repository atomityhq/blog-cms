export interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  createdAt: string;
}

/** A tag as embedded in a post. */
export interface TagRef {
  id: string;
  name: string;
  slug: string;
}

export interface TagInput {
  name: string;
  slug: string;
}
