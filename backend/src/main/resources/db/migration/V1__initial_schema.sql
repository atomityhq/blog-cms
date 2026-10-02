-- Initial schema: authors, tags, media library, posts and their relations.
-- All ids are UUIDs assigned by the application; all timestamps are UTC TIMESTAMPTZ.

-- Trigram indexes make the posts list's substring search (ILIKE '%term%') index-backed.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE media (
    id                UUID         PRIMARY KEY,
    storage_key       VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type      VARCHAR(50)  NOT NULL,
    size_bytes        BIGINT       NOT NULL,
    width             INTEGER      NOT NULL,
    height            INTEGER      NOT NULL,
    alt_text          VARCHAR(300) NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_media_storage_key UNIQUE (storage_key)
);

CREATE INDEX idx_media_created_at ON media (created_at DESC);

CREATE TABLE authors (
    id         UUID         PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    slug       VARCHAR(120) NOT NULL,
    bio        VARCHAR(500) NOT NULL DEFAULT '',
    avatar_id  UUID         REFERENCES media (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_authors_slug UNIQUE (slug)
);

CREATE INDEX idx_authors_avatar_id ON authors (avatar_id);

CREATE TABLE tags (
    id         UUID        PRIMARY KEY,
    name       VARCHAR(60) NOT NULL,
    slug       VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tags_slug UNIQUE (slug)
);

CREATE TABLE posts (
    id                   UUID          PRIMARY KEY,
    title                VARCHAR(200)  NOT NULL DEFAULT '',
    slug                 VARCHAR(160)  NOT NULL,
    excerpt              VARCHAR(300)  NOT NULL DEFAULT '',
    -- Tiptap/ProseMirror document. content_text is its plain text, derived on save,
    -- used for search and the word count.
    content              JSONB         NOT NULL,
    content_text         TEXT          NOT NULL DEFAULT '',
    status               VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    featured             BOOLEAN       NOT NULL DEFAULT FALSE,
    cover_image_id       UUID          REFERENCES media (id) ON DELETE RESTRICT,
    cover_image_alt      VARCHAR(300)  NOT NULL DEFAULT '',
    seo_title            VARCHAR(70)   NOT NULL DEFAULT '',
    meta_description     VARCHAR(160)  NOT NULL DEFAULT '',
    focus_keyword        VARCHAR(100)  NOT NULL DEFAULT '',
    canonical_url        VARCHAR(500)  NOT NULL DEFAULT '',
    word_count           INTEGER       NOT NULL DEFAULT 0,
    reading_time_minutes INTEGER       NOT NULL DEFAULT 0,
    -- Set the first time the post is published; kept across unpublish/republish.
    published_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- Optimistic-locking counter (JPA @Version).
    version              BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uq_posts_slug UNIQUE (slug),
    CONSTRAINT ck_posts_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

CREATE INDEX idx_posts_status_updated_at ON posts (status, updated_at DESC);
CREATE INDEX idx_posts_cover_image_id ON posts (cover_image_id);
CREATE INDEX idx_posts_title_trgm ON posts USING gin (title gin_trgm_ops);
CREATE INDEX idx_posts_excerpt_trgm ON posts USING gin (excerpt gin_trgm_ops);
CREATE INDEX idx_posts_content_text_trgm ON posts USING gin (content_text gin_trgm_ops);

-- Ordered: the first author is the byline's lead. Keyed by position (JPA @OrderColumn);
-- no unique (post_id, author_id) because Hibernate reorders by rewriting rows in place,
-- which would trip it mid-swap. The service rejects duplicate authors instead.
CREATE TABLE post_authors (
    post_id   UUID    NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    author_id UUID    NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    PRIMARY KEY (post_id, position)
);

CREATE INDEX idx_post_authors_author_id ON post_authors (author_id);

CREATE TABLE post_tags (
    post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    tag_id  UUID NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_tag_id ON post_tags (tag_id);

-- Images embedded in a post's body (derived from the content JSON on save), so a
-- library image can't be deleted while a post still shows it.
CREATE TABLE post_images (
    post_id  UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media (id) ON DELETE RESTRICT,
    PRIMARY KEY (post_id, media_id)
);

CREATE INDEX idx_post_images_media_id ON post_images (media_id);
